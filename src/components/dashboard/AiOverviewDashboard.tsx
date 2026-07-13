import { Eye, Hash, Heading, ListOrdered, Search, Smile, TrendingUp, Type } from "lucide-react";
import type { ContentBlockShare, TopicSection } from "@/lib/aio/parseAioContent";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Delta, fmtScore, sentimentLabel, Sparkline } from "./kpi-helpers";

interface SerpDistribution {
  pos1: number;
  pos2: number;
  pos3plus: number;
  noAio: number;
}

interface AiModeMetrics {
  presenceRate: number | null;
  avgSerpPosition: number | null;
  totalSnapshots: number;
}

interface Props {
  // Métricas derivadas del texto del modelo
  visibility: number | null;
  visibilitySeries: number[];
  visibilityDelta: number | null;
  ownSov: number;
  avgSentiment: number | null;
  sentimentDelta: number | null;
  topicSections: TopicSection[];
  contentStructure: ContentBlockShare[];
  blocksAnalyzed: number;
  responsesAnalyzed: number;
  rangeLabel: string;
  // Métricas SERP reales — AI Overviews (null = caché vacía, mostrar placeholder)
  presenceRate: number | null;
  avgSerpPosition: number | null;
  serpDistribution: SerpDistribution | null;
  serpTopicSections: Array<{ name: string; count: number }>;
  totalSnapshots: number;
  // Métricas SERP reales — AI Mode
  aiModeMetrics?: AiModeMetrics;
}

const BLOCK_COLORS: Record<string, string> = {
  Text: "#2563eb",
  List: "#7c3aed",
  Table: "#0891b2",
  Heading: "#d97706",
  Code: "#475569",
};

const SERP_COLORS = {
  pos1: "#22c55e",
  pos2: "#3b82f6",
  pos3plus: "#f59e0b",
  noAio: "#e2e8f0",
};

export function AiOverviewDashboard({
  visibility,
  visibilitySeries,
  visibilityDelta,
  ownSov,
  avgSentiment,
  sentimentDelta,
  topicSections,
  contentStructure,
  blocksAnalyzed,
  responsesAnalyzed,
  rangeLabel,
  presenceRate,
  avgSerpPosition,
  serpDistribution,
  serpTopicSections,
  totalSnapshots,
  aiModeMetrics,
}: Props) {
  const sent = sentimentLabel(avgSentiment);
  const hasSerpData = totalSnapshots > 0;

  // Secciones a mostrar: SERP reales si hay caché, sino aproximación del texto
  const displaySections =
    serpTopicSections.length > 0 ? serpTopicSections : topicSections;
  const sectionsSource = serpTopicSections.length > 0 ? "serp" : "text";
  const maxSectionCount = displaySections.reduce((m, s) => Math.max(m, s.count), 0);

  return (
    <div className="space-y-6">
      {/* ── Contexto de mercado (superficies de IA) ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Contexto de mercado · superficies de IA
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* AIO Presence Rate */}
        <KpiCard
          label="AIO Presence Rate"
          info="% de tus consultas donde aparece el recuadro AI Overview de Google. Mide cuánto de tu categoría responde ya la IA (contexto de oportunidad, no rendimiento)."
          icon={<Search className="w-4 h-4 text-rose-500" aria-hidden="true" />}
          iconBg="bg-rose-50"
        >
          {hasSerpData && presenceRate !== null ? (
            <>
              <p className="text-3xl font-bold text-slate-900">{presenceRate}%</p>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {totalSnapshots} queries analizadas
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Sin datos SERP. Ejecuta el refresco semanal para activar.
              </p>
            </>
          )}
        </KpiCard>

        {/* Average SERP Position */}
        <KpiCard
          label="Avg SERP Position"
          info="Posición media del bloque AI Overview en la SERP. Secundaria: suele ir arriba por naturaleza."
          icon={<ListOrdered className="w-4 h-4 text-blue-500" aria-hidden="true" />}
          iconBg="bg-blue-50"
        >
          {hasSerpData ? (
            <>
              <p className="text-3xl font-bold text-slate-900">
                {avgSerpPosition !== null ? `#${avgSerpPosition}` : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {avgSerpPosition === null ? "No aparece en ninguna query" : "Posición media en la SERP"}
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Sin datos SERP. Ejecuta el refresco semanal para activar.
              </p>
            </>
          )}
        </KpiCard>

        {/* AI Mode Presence Rate */}
        <KpiCard
          label="AI Mode Presence"
          info="% de consultas donde Google AI Mode (pestaña conversacional tipo ChatGPT) da respuesta. Indicador de futuro; menor alcance hoy."
          icon={<Search className="w-4 h-4 text-violet-500" aria-hidden="true" />}
          iconBg="bg-violet-50"
        >
          {hasSerpData && aiModeMetrics && aiModeMetrics.presenceRate !== null ? (
            <>
              <p className="text-3xl font-bold text-slate-900">{aiModeMetrics.presenceRate}%</p>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Google AI Mode en SERP
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Sin datos SERP. Ejecuta el refresco semanal para activar.
              </p>
            </>
          )}
        </KpiCard>

        {/* AI Mode Position */}
        <KpiCard
          label="AI Mode Position"
          info="Presencia en AI Mode. Es una respuesta única, no un bloque posicional: por eso #1 cuando apareces. Secundaria."
          icon={<Hash className="w-4 h-4 text-violet-400" aria-hidden="true" />}
          iconBg="bg-violet-50"
        >
          {hasSerpData && aiModeMetrics ? (
            <>
              <p className="text-3xl font-bold text-slate-900">
                {aiModeMetrics.avgSerpPosition !== null ? `#${aiModeMetrics.avgSerpPosition}` : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {aiModeMetrics.avgSerpPosition === null ? "No aparece en ninguna query" : "Posición media en SERP"}
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300">—</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Sin datos SERP. Ejecuta el refresco semanal para activar.
              </p>
            </>
          )}
        </KpiCard>
        </div>
      </div>

      {/* ── Rendimiento de tu marca ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Rendimiento de tu marca
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Visibility */}
        <KpiCard
          label="Visibility"
          info="% de respuestas de IA donde aparece tu marca. Rendimiento: mide si te están citando."
          icon={<Eye className="w-4 h-4 text-indigo-500" aria-hidden="true" />}
          iconBg="bg-indigo-50"
        >
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-slate-900">
              {visibility != null ? `${visibility}%` : "—"}
            </p>
            <Delta value={visibilityDelta} suffix="%" />
          </div>
          <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            % de respuestas donde aparece tu marca
          </p>
          <Sparkline values={visibilitySeries} strokeColor="#6366f1" fillColor="#6366f1" />
        </KpiCard>

        {/* Share of Voice */}
        <KpiCard
          label="Share of Voice"
          info="Tu cuota de menciones frente a competidores en las respuestas de IA. La métrica clave: ¿te recomienda la IA a ti o a la competencia?"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
          iconBg="bg-emerald-50"
        >
          <p className="text-3xl font-bold text-slate-900">
            {`${Math.round(ownSov * 10) / 10}%`}
          </p>
          <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Tu cuota sobre todas las menciones de marca
          </p>
        </KpiCard>

        {/* AI Overview Sentiment */}
        <KpiCard
          label="Sentiment"
          info="Tono con el que la IA menciona tu marca: positivo, neutral o negativo."
          icon={<Smile className="w-4 h-4 text-amber-500" aria-hidden="true" />}
          iconBg="bg-amber-50"
        >
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${sent.color}`}>{sent.text}</p>
            {avgSentiment !== null && (
              <span className={`text-sm font-mono font-semibold ${sent.color} opacity-75`}>
                {fmtScore(avgSentiment)}
              </span>
            )}
            <Delta value={sentimentDelta} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{rangeLabel}</p>
          <p className="text-[11px] text-slate-400 mt-1">Desde menciones del AI Overview</p>
        </KpiCard>
        </div>
      </div>

      {/* ── Lower grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* SERP Position Distribution */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-slate-800">SERP Position Distribution</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ¿Dónde aparece el AI Overview en la página de resultados?
              </p>
              {hasSerpData && serpDistribution ? (
                <SerpDistributionBar dist={serpDistribution} total={totalSnapshots} />
              ) : (
                <>
                  <div className="mt-4 h-3 rounded-full bg-slate-100" />
                  <p className="text-xs text-slate-400 mt-3 italic">
                    Sin datos SERP · Ejecuta el refresco semanal para activar.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Content Structure */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-blue-500" aria-hidden="true" />
                Content Structure
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cómo estructura sus respuestas el AI Overview
              </p>
              {contentStructure.length === 0 ? (
                <p className="text-sm text-slate-400 mt-4 italic">
                  Sin respuestas analizadas en el período.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {contentStructure.map((block) => (
                    <div key={block.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{block.type}</span>
                        <span className="text-slate-500 tabular-nums">{block.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${block.pct}%`,
                            backgroundColor: BLOCK_COLORS[block.type] ?? "#64748b",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-4">
                {blocksAnalyzed.toLocaleString()} bloques · {responsesAnalyzed.toLocaleString()} respuestas analizadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Topic Sections */}
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-violet-500" aria-hidden="true" />
              Topic Sections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {sectionsSource === "serp"
                ? "Encabezados reales de la SERP de Google"
                : "Encabezados detectados en las respuestas del modelo"}
            </p>
            {displaySections.length === 0 ? (
              <p className="text-sm text-slate-400 mt-4 italic">
                Sin encabezados detectados en el período.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {displaySections.map((section) => (
                  <div key={section.name}>
                    <div className="flex items-center justify-between text-xs mb-1 gap-2">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5 min-w-0">
                        <Heading className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">{section.name}</span>
                      </span>
                      <span className="text-slate-500 tabular-nums shrink-0">{section.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-400"
                        style={{
                          width: `${maxSectionCount > 0 ? (section.count / maxSectionCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-4">
              {displaySections.length} encabezados ·{" "}
              {sectionsSource === "serp"
                ? `${totalSnapshots.toLocaleString()} snapshots SERP`
                : `${responsesAnalyzed.toLocaleString()} respuestas analizadas`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function SerpDistributionBar({
  dist,
  total,
}: {
  dist: SerpDistribution;
  total: number;
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const p1 = pct(dist.pos1);
  const p2 = pct(dist.pos2);
  const p3 = pct(dist.pos3plus);
  const pNo = pct(dist.noAio);

  return (
    <div className="mt-4">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {p1 > 0 && (
          <div style={{ width: `${p1}%`, backgroundColor: SERP_COLORS.pos1 }} title={`Position 1: ${Math.round(p1)}%`} />
        )}
        {p2 > 0 && (
          <div style={{ width: `${p2}%`, backgroundColor: SERP_COLORS.pos2 }} title={`Position 2: ${Math.round(p2)}%`} />
        )}
        {p3 > 0 && (
          <div style={{ width: `${p3}%`, backgroundColor: SERP_COLORS.pos3plus }} title={`Position 3+: ${Math.round(p3)}%`} />
        )}
        {pNo > 0 && (
          <div style={{ width: `${pNo}%`, backgroundColor: SERP_COLORS.noAio }} title={`No AI Overview: ${Math.round(pNo)}%`} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-600">
        <LegendDot color={SERP_COLORS.pos1} label={`Position 1: ${Math.round(p1)}%`} />
        <LegendDot color={SERP_COLORS.pos2} label={`Position 2: ${Math.round(p2)}%`} />
        <LegendDot color={SERP_COLORS.pos3plus} label={`Position 3+: ${Math.round(p3)}%`} />
        <LegendDot color={SERP_COLORS.noAio} label={`No AI Overview: ${Math.round(pNo)}%`} />
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        Basado en {total.toLocaleString()} queries analizadas
      </p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function KpiCard({
  label,
  icon,
  iconBg,
  info,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
            {info ? <InfoTooltip content={info} /> : null}
          </div>
          <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
        </div>
        <div className="mt-2">{children}</div>
      </CardContent>
    </Card>
  );
}
