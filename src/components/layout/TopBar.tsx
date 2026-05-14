"use client";

import { Plus, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LlmProviderKey } from "@/types";
import { PlanBanner } from "./PlanBanner";

const LLM_TABS: { key: LlmProviderKey; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "perplexity", label: "Perplexity" },
  { key: "deepseek", label: "DeepSeek" },
];

interface TopBarProps {
  activePromptsCount: number;
  maxPrompts?: number;
  onAddPrompt?: () => void;
}

export function TopBar({ activePromptsCount, maxPrompts = 10, onAddPrompt }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLlm = (searchParams.get("llm") ?? "chatgpt") as LlmProviderKey;

  const handleLlmChange = useCallback(
    (key: LlmProviderKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("llm", key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 shrink-0">
      {/* LLM Selector tabs */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
        {LLM_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleLlmChange(key)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              currentLlm === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Optimize — coming soon */}
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 text-xs text-slate-400 cursor-not-allowed"
        disabled
      >
        <Sparkles className="w-3.5 h-3.5" />
        Optimize
        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[10px] font-medium uppercase tracking-wide">
          Próximamente
        </span>
      </button>

      {/* Plan banner */}
      <div className="flex-1 flex justify-center">
        <PlanBanner activePromptsCount={activePromptsCount} maxPrompts={maxPrompts} />
      </div>

      {/* Add Prompt button */}
      <Button
        size="sm"
        onClick={onAddPrompt}
        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
      >
        <Plus className="w-4 h-4 mr-1" />
        Añadir Prompt
      </Button>
    </header>
  );
}
