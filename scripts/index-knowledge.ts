import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import matter from "gray-matter";
import type { Heading, Root, RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import OpenAI from "openai";
import remarkParse from "remark-parse";
import { unified } from "unified";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const KB_DIR = path.join(process.cwd(), "content/geo-knowledge");
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const EMBEDDING_PRICE_PER_M_TOKENS = 0.02;
const MIN_CHUNK_CHARS = 100;
const MAX_CHUNK_CHARS = 6000;
const BATCH_SIZE = 100;

interface Chunk {
  source_file: string;
  source_title: string;
  heading_path: string[];
  content: string;
  content_hash: string;
  tags: string[];
  category: string | null;
  token_count: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias ?? target);
}

function nodeToMarkdown(node: RootContent): string {
  if (node.type === "heading") {
    const text = mdastToString(node);
    return `${"#".repeat(node.depth)} ${text}`;
  }
  if (node.type === "code") {
    const lang = node.lang ?? "";
    return `\`\`\`${lang}\n${node.value}\n\`\`\``;
  }
  if (node.type === "list") {
    return node.children.map((item) => `- ${mdastToString(item).trim()}`).join("\n");
  }
  return mdastToString(node);
}

function chunkByHeadings(
  ast: Root,
  sourceTitle: string
): Array<{ heading_path: string[]; content: string }> {
  const chunks: Array<{ heading_path: string[]; content: string }> = [];
  let currentPath: string[] = [];
  let currentBuffer: string[] = [];

  const flush = () => {
    const content = currentBuffer.join("\n\n").trim();
    if (content.length >= MIN_CHUNK_CHARS) {
      const sliced = content.length > MAX_CHUNK_CHARS ? content.slice(0, MAX_CHUNK_CHARS) : content;
      chunks.push({ heading_path: [...currentPath], content: sliced });
    }
    currentBuffer = [];
  };

  for (const node of ast.children) {
    if (node.type === "heading") {
      const heading = node as Heading;
      if (heading.depth <= 1) continue;
      flush();
      const headingText = mdastToString(heading);
      currentPath = currentPath.slice(0, heading.depth - 2);
      currentPath.push(headingText);
      continue;
    }
    currentBuffer.push(nodeToMarkdown(node));
  }
  flush();

  if (chunks.length === 0) {
    const fullContent = ast.children.map(nodeToMarkdown).join("\n\n").trim();
    if (fullContent.length >= MIN_CHUNK_CHARS) {
      const sliced =
        fullContent.length > MAX_CHUNK_CHARS ? fullContent.slice(0, MAX_CHUNK_CHARS) : fullContent;
      chunks.push({ heading_path: [sourceTitle], content: sliced });
    }
  }

  return chunks;
}

function parseFile(filePath: string): Chunk[] {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const cleanContent = stripWikilinks(content);

  const ast = unified().use(remarkParse).parse(cleanContent) as Root;

  const sourceTitle =
    (typeof data.title === "string" && data.title) ||
    extractH1(ast) ||
    filename.replace(/\.md$/, "");

  const tags = Array.isArray(data.tags)
    ? (data.tags as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const category = typeof data.category === "string" ? data.category : null;

  const headingChunks = chunkByHeadings(ast, sourceTitle);

  return headingChunks.map((c) => {
    const headerText = `${sourceTitle} › ${c.heading_path.join(" › ")}`;
    const fullContent = `${headerText}\n\n${c.content}`;
    return {
      source_file: filename,
      source_title: sourceTitle,
      heading_path: c.heading_path,
      content: fullContent,
      content_hash: sha256(fullContent),
      tags,
      category,
      token_count: estimateTokens(fullContent),
    };
  });
}

function extractH1(ast: Root): string | null {
  for (const node of ast.children) {
    if (node.type === "heading" && node.depth === 1) {
      return mdastToString(node);
    }
  }
  return null;
}

async function embedBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMS,
  });
  return response.data.map((d) => d.embedding);
}

// biome-ignore lint/suspicious/noExplicitAny: service client type varies across callers
type SupabaseService = ReturnType<typeof createClient<any, any, any>>;

async function loadExistingHashes(supabase: SupabaseService): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("source_file, content_hash")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const set = map.get(row.source_file as string) ?? new Set<string>();
      set.add(row.content_hash as string);
      map.set(row.source_file as string, set);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function printStats(supabase: SupabaseService): Promise<void> {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("source_file, token_count");
  if (error) throw error;
  const rows = data ?? [];
  const byFile = new Map<string, { count: number; tokens: number }>();
  for (const row of rows) {
    const file = row.source_file as string;
    const tokens = row.token_count as number;
    const entry = byFile.get(file) ?? { count: 0, tokens: 0 };
    entry.count += 1;
    entry.tokens += tokens;
    byFile.set(file, entry);
  }
  const totalChunks = rows.length;
  const totalTokens = rows.reduce((acc, r) => acc + (r.token_count as number), 0);
  console.log(`\n=== Knowledge base stats ===`);
  console.log(`Files indexed: ${byFile.size}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`\nPer-file breakdown:`);
  const sorted = [...byFile.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [file, info] of sorted) {
    console.log(
      `  ${file.padEnd(50)} ${String(info.count).padStart(3)} chunks · ${info.tokens.toString().padStart(7)} tokens`
    );
  }
}

async function main() {
  const isStats = process.argv.includes("--stats");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (isStats) {
    await printStats(supabase);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY_EMBEDDINGS ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Faltan OPENAI_API_KEY_EMBEDDINGS u OPENAI_API_KEY");
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey });

  if (!fs.existsSync(KB_DIR)) {
    console.error(`No existe la carpeta ${KB_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => path.join(KB_DIR, f));

  console.log(`Parsing ${files.length} markdown files from ${KB_DIR}...`);

  const allChunks: Chunk[] = [];
  for (const filePath of files) {
    const chunks = parseFile(filePath);
    allChunks.push(...chunks);
  }
  console.log(`Generated ${allChunks.length} chunks total`);

  const existing = await loadExistingHashes(supabase);
  console.log(`Existing chunks in DB: ${[...existing.values()].reduce((a, s) => a + s.size, 0)}`);

  const toUpsert: Chunk[] = [];
  let skipped = 0;
  for (const chunk of allChunks) {
    const hashes = existing.get(chunk.source_file);
    if (hashes?.has(chunk.content_hash)) {
      skipped += 1;
      continue;
    }
    toUpsert.push(chunk);
  }
  console.log(`Skipped (unchanged): ${skipped}`);
  console.log(`To embed + upsert: ${toUpsert.length}`);

  const filesOnDisk = new Set(allChunks.map((c) => c.source_file));
  const orphanFiles = [...existing.keys()].filter((f) => !filesOnDisk.has(f));
  if (orphanFiles.length > 0) {
    const { error: delError } = await supabase
      .from("knowledge_chunks")
      .delete()
      .in("source_file", orphanFiles);
    if (delError) {
      console.error(`Error deleting orphan files:`, delError);
    } else {
      console.log(`Deleted orphan chunks for files: ${orphanFiles.join(", ")}`);
    }
  }

  const hashesByFile = new Map<string, Set<string>>();
  for (const chunk of allChunks) {
    const set = hashesByFile.get(chunk.source_file) ?? new Set<string>();
    set.add(chunk.content_hash);
    hashesByFile.set(chunk.source_file, set);
  }
  for (const [file, currentHashes] of hashesByFile) {
    const dbHashes = existing.get(file);
    if (!dbHashes) continue;
    const staleHashes = [...dbHashes].filter((h) => !currentHashes.has(h));
    if (staleHashes.length > 0) {
      const { error: delError } = await supabase
        .from("knowledge_chunks")
        .delete()
        .eq("source_file", file)
        .in("content_hash", staleHashes);
      if (delError) console.error(`Error deleting stale chunks for ${file}:`, delError);
      else console.log(`Deleted ${staleHashes.length} stale chunks for ${file}`);
    }
  }

  let totalTokensEmbedded = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE);
    // Dedup within batch to avoid "row a second time" error on upsert
    const deduped = new Map<string, (typeof batch)[0]>();
    for (const chunk of batch) {
      const key = `${chunk.source_file}:${chunk.content_hash}`;
      if (!deduped.has(key)) {
        deduped.set(key, chunk);
      }
    }
    const uniqueBatch = [...deduped.values()];
    const texts = uniqueBatch.map((c) => c.content);
    process.stdout.write(
      `  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toUpsert.length / BATCH_SIZE)} (${uniqueBatch.length} chunks)... `
    );
    const embeddings = await embedBatch(openai, texts);
    const rows = uniqueBatch.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx],
    }));
    const { error } = await supabase.from("knowledge_chunks").upsert(rows, {
      onConflict: "source_file,content_hash",
    });
    if (error) {
      console.error(`\nUpsert error:`, error);
      process.exit(1);
    }
    const batchTokens = batch.reduce((a, c) => a + c.token_count, 0);
    totalTokensEmbedded += batchTokens;
    console.log(`ok (${batchTokens.toLocaleString()} tokens)`);
  }

  const cost = (totalTokensEmbedded / 1_000_000) * EMBEDDING_PRICE_PER_M_TOKENS;
  console.log(`\n=== Summary ===`);
  console.log(`Files: ${files.length}`);
  console.log(`Chunks parsed: ${allChunks.length}`);
  console.log(`New/updated: ${toUpsert.length}`);
  console.log(`Skipped (unchanged): ${skipped}`);
  console.log(`Orphan files removed: ${orphanFiles.length}`);
  console.log(`Tokens embedded: ${totalTokensEmbedded.toLocaleString()}`);
  console.log(`Estimated cost: $${cost.toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
