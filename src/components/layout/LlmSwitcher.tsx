"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LLM_OPTIONS = [
  { value: "all", label: "All LLMs" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "gemini", label: "AI Overviews" },
  { value: "perplexity", label: "Perplexity" },
];

export function LlmSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLlm = searchParams.get("llm") ?? "all";

  const handleLlmChange = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") {
        params.delete("llm");
      } else {
        params.set("llm", value);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  return (
    <Select value={currentLlm} onValueChange={handleLlmChange}>
      <SelectTrigger className="h-8 w-[150px] text-xs border-slate-200 font-medium">
        <SelectValue placeholder="All LLMs" />
      </SelectTrigger>
      <SelectContent>
        {LLM_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
