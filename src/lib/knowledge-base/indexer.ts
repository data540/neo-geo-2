import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { createEmbeddings } from "@/lib/llm/embeddings";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeBaseStats, KnowledgeFile } from "@/types";

const MIN_CHUNK_CHARS = 100;
const MAX_CHUNK_CHARS = 6000;
const BATCH_SIZE = 100;
const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), "content/geo-knowledge");

interface ChunkData {
  content: string;
  contentHash: string;
  sourceFile: string;
  sourceTitle: string;
  headingPath: string[];
  tags: string[];
  category: string | null;
  tokenCount: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function generateHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function parseMarkdownFile(
  filePath: string,
  filename: string
): { chunks: ChunkData[]; title: string } {
  const content = readFileSync(filePath, "utf-8");

  // Parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  let title = filename.replace(".md", "");
  let tags: string[] = [];
  let category: string | null = null;

  if (frontmatterMatch?.[1]) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    if (titleMatch?.[1]) title = titleMatch[1].trim();

    const tagsMatch = frontmatter.match(/^tags:\s*\[(.*?)\]/m);
    if (tagsMatch?.[1]) {
      tags = tagsMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/["']/g, ""))
        .filter(Boolean);
    }

    const categoryMatch = frontmatter.match(/^category:\s*(.+)$/m);
    if (categoryMatch?.[1]) category = categoryMatch[1].trim();
  }

  const mdContent = content.replace(/^---\n[\s\S]*?\n---\n/, "");

  // Parse markdown and chunk by headings
  const chunks: ChunkData[] = [];
  const lines = mdContent.split("\n");
  let currentChunk = "";
  let headingPath: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);

    if (headingMatch?.[1] && headingMatch?.[2]) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      if (level === 2) {
        headingPath = [heading];
      } else if (level === 3 && headingPath[0]) {
        headingPath = [headingPath[0], heading];
      }

      // Save previous chunk if it's big enough
      if (currentChunk.length >= MIN_CHUNK_CHARS) {
        const contentHash = generateHash(currentChunk);
        chunks.push({
          content: currentChunk,
          contentHash,
          sourceFile: filename,
          sourceTitle: title,
          headingPath: [...headingPath],
          tags,
          category,
          tokenCount: estimateTokens(currentChunk),
        });
      }

      currentChunk = `${heading}\n\n`;
    } else if (line.trim()) {
      currentChunk += line + "\n";

      // Split chunk if it's too big
      if (currentChunk.length > MAX_CHUNK_CHARS) {
        const contentHash = generateHash(currentChunk);
        chunks.push({
          content: currentChunk,
          contentHash,
          sourceFile: filename,
          sourceTitle: title,
          headingPath: [...headingPath],
          tags,
          category,
          tokenCount: estimateTokens(currentChunk),
        });
        currentChunk = "";
      }
    }
  }

  // Save final chunk
  if (currentChunk.length >= MIN_CHUNK_CHARS) {
    const contentHash = generateHash(currentChunk);
    chunks.push({
      content: currentChunk,
      contentHash,
      sourceFile: filename,
      sourceTitle: title,
      headingPath: [...headingPath],
      tags,
      category,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return { chunks, title };
}

export async function embedChunks(chunks: ChunkData[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    embeddings.push(...(await createEmbeddings(texts)));
  }

  return embeddings;
}

export async function indexSingleFile(
  content: string,
  filename: string
): Promise<{ chunksCount: number; tokenCount: number }> {
  // Parse and chunk the content
  const tempPath = path.join("/tmp", filename);
  const { chunks } = parseMarkdownFile(tempPath, filename);

  if (chunks.length === 0) {
    return { chunksCount: 0, tokenCount: 0 };
  }

  // Embed chunks
  const embeddings = await embedChunks(chunks);

  // Upsert into database
  const supabase = await createClient();

  const insertData = chunks.map((chunk, idx) => ({
    source_file: chunk.sourceFile,
    source_title: chunk.sourceTitle,
    heading_path: chunk.headingPath,
    content: chunk.content,
    content_hash: chunk.contentHash,
    tags: chunk.tags,
    category: chunk.category,
    token_count: chunk.tokenCount,
    embedding: embeddings[idx],
  }));

  const { error } = await supabase.from("knowledge_chunks").upsert(insertData, {
    onConflict: "source_file,content_hash",
  });

  if (error) {
    throw new Error(`Failed to upsert chunks: ${error.message}`);
  }

  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  return { chunksCount: chunks.length, tokenCount: totalTokens };
}

export async function reindexKnowledgeBase(): Promise<{
  totalChunks: number;
  totalTokens: number;
  filesProcessed: number;
}> {
  if (!existsSync(KNOWLEDGE_BASE_DIR)) {
    throw new Error(`Knowledge base directory not found: ${KNOWLEDGE_BASE_DIR}`);
  }

  const files = readdirSync(KNOWLEDGE_BASE_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  let totalChunks = 0;
  let totalTokens = 0;

  const supabase = await createClient();

  // Process each file
  for (const filename of files) {
    const filePath = path.join(KNOWLEDGE_BASE_DIR, filename);
    const { chunks } = parseMarkdownFile(filePath, filename);

    if (chunks.length === 0) continue;

    // Embed chunks
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);

      embeddings.push(...(await createEmbeddings(texts)));
    }

    // Upsert into database
    const insertData = chunks.map((chunk, idx) => ({
      source_file: chunk.sourceFile,
      source_title: chunk.sourceTitle,
      heading_path: chunk.headingPath,
      content: chunk.content,
      content_hash: chunk.contentHash,
      tags: chunk.tags,
      category: chunk.category,
      token_count: chunk.tokenCount,
      embedding: embeddings[idx],
    }));

    const { error } = await supabase.from("knowledge_chunks").upsert(insertData, {
      onConflict: "source_file,content_hash",
    });

    if (error) {
      console.error(`Error upserting chunks for ${filename}: ${error.message}`);
      continue;
    }

    totalChunks += chunks.length;
    totalTokens += chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  }

  // Delete orphaned chunks (files no longer in disk)
  const { data: existingFiles } = await supabase.from("knowledge_chunks").select("source_file");

  if (existingFiles && existingFiles.length > 0) {
    const fileSet = new Set(files);
    const uniqueFiles = new Set(
      (existingFiles as Array<{ source_file: string }>).map((f) => f.source_file)
    );
    const orphanedFiles = Array.from(uniqueFiles).filter((f) => !fileSet.has(f));

    for (const orphanFile of orphanedFiles) {
      await supabase.from("knowledge_chunks").delete().eq("source_file", orphanFile);
    }
  }

  return { totalChunks, totalTokens, filesProcessed: files.length };
}

export async function getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_knowledge_base_stats");

  if (error) {
    return { totalChunks: 0, totalTokens: 0, filesCount: 0, lastUpdated: null };
  }

  if (!data || data.length === 0) {
    return { totalChunks: 0, totalTokens: 0, filesCount: 0, lastUpdated: null };
  }

  const stats = data[0];
  return {
    totalChunks: stats.total_chunks || 0,
    totalTokens: stats.total_tokens || 0,
    filesCount: stats.files_count || 0,
    lastUpdated: stats.last_updated || null,
  };
}

export async function listKnowledgeFiles(): Promise<KnowledgeFile[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("source_file, token_count, updated_at")
    .order("source_file");

  if (error || !data) {
    return [];
  }

  // Group by file
  const fileMap = new Map<
    string,
    { tokenCount: number; chunkCount: number; lastUpdated: string }
  >();

  for (const row of data) {
    const file = row.source_file as string;
    if (!fileMap.has(file)) {
      fileMap.set(file, {
        tokenCount: 0,
        chunkCount: 0,
        lastUpdated: row.updated_at as string,
      });
    }
    const entry = fileMap.get(file)!;
    entry.tokenCount += (row.token_count as number) || 0;
    entry.chunkCount += 1;
    entry.lastUpdated = row.updated_at as string;
  }

  return Array.from(fileMap.entries()).map(([filename, stats]) => ({
    filename,
    chunkCount: stats.chunkCount,
    tokenCount: stats.tokenCount,
    lastUpdated: stats.lastUpdated,
  }));
}
