"use client";

import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertLlmConfigAction } from "@/actions/llm-config";
import { Button } from "@/components/ui/button";
import type { LlmProviderKey, WorkspaceMemberRole } from "@/types";

const PROVIDER_LABELS: Record<LlmProviderKey, string> = {
  chatgpt: "ChatGPT (GPT-4.1 Nano)",
  claude: "Claude (Haiku 3.5)",
  gemini: "Gemini (2.0 Flash)",
  perplexity: "Perplexity (Sonar)",
  deepseek: "DeepSeek (Chat v3)",
};

interface ProviderConfig {
  providerId: string;
  providerKey: LlmProviderKey;
  providerName: string;
  promptsPerDay: number;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  currentRole: WorkspaceMemberRole;
  configs: ProviderConfig[];
}

export function LlmConfigPanel({ workspaceId, workspaceSlug, currentRole, configs }: Props) {
  const canManage = currentRole === "owner" || currentRole === "admin";
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(configs.map((c) => [c.providerId, c.promptsPerDay]))
  );

  function handleSliderChange(providerId: string, value: number) {
    setValues((prev) => ({ ...prev, [providerId]: value }));
  }

  function handleSave() {
    if (!canManage) return;

    startTransition(async () => {
      const result = await upsertLlmConfigAction({
        workspaceId,
        workspaceSlug,
        configs: configs.map((c) => ({
          llmProviderId: c.providerId,
          promptsPerDay: values[c.providerId] ?? 0,
        })),
      });

      if (result.success) {
        toast.success("LLM settings saved");
      } else {
        toast.error(result.error ?? "Could not save settings");
      }
    });
  }

  const totalPerDay = Object.values(values).reduce((a, b) => a + b, 0);

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Daily prompt allocation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total across all providers:{" "}
            <span className="font-medium text-slate-700">{totalPerDay} prompts/day</span>
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canManage || pending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
      </div>

      <div className="space-y-6">
        {configs.map((config) => {
          const current = values[config.providerId] ?? 0;
          return (
            <div key={config.providerId} className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`slider-${config.providerId}`}
                  className="text-sm font-medium text-slate-700"
                >
                  {PROVIDER_LABELS[config.providerKey] ?? config.providerName}
                </label>
                <span className="text-sm tabular-nums w-24 text-right">
                  {current === 0 ? (
                    <span className="text-slate-400">Disabled</span>
                  ) : (
                    <span className="text-indigo-600 font-medium">{current} / day</span>
                  )}
                </span>
              </div>

              <input
                id={`slider-${config.providerId}`}
                type="range"
                min={0}
                max={50}
                step={1}
                value={current}
                disabled={!canManage || pending}
                onChange={(e) => handleSliderChange(config.providerId, Number(e.target.value))}
                className="w-full h-2 rounded-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="flex justify-between text-xs text-slate-400">
                <span>0 (off)</span>
                <span>50</span>
              </div>
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          Only owners and admins can change LLM settings.
        </p>
      )}
    </section>
  );
}
