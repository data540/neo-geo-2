"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getOpenRouterModelsAction,
  type OpenRouterModel,
  upsertLlmConfigAction,
} from "@/actions/llm-config";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OPENROUTER_MODELS,
  resolveConfiguredOpenRouterModel,
} from "@/lib/llm/modelDefaults";
import type { LlmProviderKey, WorkspaceMemberRole } from "@/types";

const PROVIDER_LABELS: Record<LlmProviderKey, string> = {
  chatgpt: "ChatGPT",
  gemini: "AI Overviews",
  perplexity: "Perplexity",
};
const MAX_PROMPTS_PER_PROVIDER = 200;

interface ProviderConfig {
  providerId: string;
  providerKey: LlmProviderKey;
  providerName: string;
  promptsPerDay: number;
  model: string | null;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  currentRole: WorkspaceMemberRole;
  configs: ProviderConfig[];
}

function formatPrice(prompt: string, completion: string): string {
  const pIn = Number(prompt) * 1_000_000;
  const pOut = Number(completion) * 1_000_000;
  if (!pIn && !pOut) return "free";
  return `$${pIn.toFixed(2)}/$${pOut.toFixed(2)} per 1M`;
}

export function LlmConfigPanel({ workspaceId, workspaceSlug, currentRole, configs }: Props) {
  const canManage = currentRole === "owner" || currentRole === "admin";
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(configs.map((c) => [c.providerId, c.promptsPerDay]))
  );
  const [models, setModels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      configs.map((c) => [c.providerId, resolveConfiguredOpenRouterModel(c.providerKey, c.model)])
    )
  );
  // OpenRouter model lists per provider key
  const [modelLists, setModelLists] = useState<Record<string, OpenRouterModel[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});

  // Load models for all enabled providers on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: configs are server-rendered for this settings view.
  useEffect(() => {
    for (const config of configs) {
      loadModelsForProvider(config.providerId, config.providerKey);
    }
  }, []);

  async function loadModelsForProvider(providerId: string, providerKey: LlmProviderKey) {
    if (modelLists[providerId]) return; // already loaded
    setLoadingModels((prev) => ({ ...prev, [providerId]: true }));
    const result = await getOpenRouterModelsAction(providerKey);
    const providerModels = result.success ? result.data : null;
    if (providerModels) {
      setModelLists((prev) => ({ ...prev, [providerId]: providerModels }));
    }
    setLoadingModels((prev) => ({ ...prev, [providerId]: false }));
  }

  function handleSliderChange(providerId: string, value: number) {
    setValues((prev) => ({ ...prev, [providerId]: value }));
  }

  function handleModelChange(providerId: string, model: string) {
    setModels((prev) => ({ ...prev, [providerId]: model }));
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
          model: resolveConfiguredOpenRouterModel(c.providerKey, models[c.providerId]),
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

      <div className="space-y-8">
        {configs.map((config) => {
          const current = values[config.providerId] ?? 0;
          const selectedModel =
            models[config.providerId] ?? DEFAULT_OPENROUTER_MODELS[config.providerKey];
          const list = modelLists[config.providerId] ?? [];
          const isLoadingList = loadingModels[config.providerId] ?? false;
          const selectedModelData = list.find((m) => m.id === selectedModel);

          return (
            <div
              key={config.providerId}
              className="space-y-3 pb-6 border-b border-slate-100 last:border-0 last:pb-0"
            >
              {/* Provider name + prompts/day */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {PROVIDER_LABELS[config.providerKey]}
                </span>
                <span className="text-sm tabular-nums w-24 text-right">
                  {current === 0 ? (
                    <span className="text-slate-400">Disabled</span>
                  ) : (
                    <span className="text-indigo-600 font-medium">{current} / day</span>
                  )}
                </span>
              </div>

              {/* Model selector */}
              <div className="space-y-1">
                <label htmlFor={`model-${config.providerId}`} className="text-xs text-slate-500">
                  Model
                </label>
                <div className="relative">
                  {isLoadingList && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                    </div>
                  )}
                  <select
                    id={`model-${config.providerId}`}
                    value={selectedModel}
                    onChange={(e) => handleModelChange(config.providerId, e.target.value)}
                    disabled={!canManage || pending}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800 outline-none transition-colors focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50 pr-8"
                  >
                    {list.length === 0 ? (
                      <option value={selectedModel}>{selectedModel}</option>
                    ) : (
                      list.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {selectedModelData && (
                  <p className="text-xs text-slate-400">
                    {formatPrice(
                      selectedModelData.pricing.prompt,
                      selectedModelData.pricing.completion
                    )}
                    {selectedModelData.context_length > 0 && (
                      <> · {(selectedModelData.context_length / 1000).toFixed(0)}K ctx</>
                    )}
                  </p>
                )}
              </div>

              {/* Prompts/day slider */}
              <div className="space-y-1">
                <label htmlFor={`slider-${config.providerId}`} className="text-xs text-slate-500">
                  Prompts per day
                </label>
                <input
                  id={`slider-${config.providerId}`}
                  type="range"
                  min={0}
                  max={MAX_PROMPTS_PER_PROVIDER}
                  step={1}
                  value={current}
                  disabled={!canManage || pending}
                  onChange={(e) => handleSliderChange(config.providerId, Number(e.target.value))}
                  className="w-full h-2 rounded-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0 (off)</span>
                  <span>{MAX_PROMPTS_PER_PROVIDER}</span>
                </div>
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
