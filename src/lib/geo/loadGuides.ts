import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { RecommendationGuide } from "@/types";

export function loadGuides(): RecommendationGuide[] {
  const dir = path.join(process.cwd(), "content/geo-recommendations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((filename) => {
      const raw = fs.readFileSync(path.join(dir, filename), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: filename.replace(".md", ""),
        title: (data.title as string | undefined) ?? filename,
        description: (data.description as string | undefined) ?? "",
        content,
      };
    });
}
