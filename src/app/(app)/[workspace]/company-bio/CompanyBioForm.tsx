"use client";

import {
  BarChart3,
  Bolt,
  Boxes,
  Building2,
  CalendarDays,
  DollarSign,
  ExternalLink,
  Globe2,
  Grid2X2,
  Info,
  Layers,
  Loader2,
  type LucideIcon,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { extractBrandProfileAction, saveCompanyBioProfileAction } from "@/actions/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CompanyBioProfile } from "@/types";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  initialProfile: CompanyBioProfile;
  activePromptsCount: number;
  analysisError: string | null;
}

type SectionIcon = LucideIcon;

function cloneProfile(profile: CompanyBioProfile): CompanyBioProfile {
  return JSON.parse(JSON.stringify(profile)) as CompanyBioProfile;
}

function safe(val: string | null | undefined): string {
  if (!val || val === "null" || val === "undefined") return "";
  return val;
}

function linesToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

function formatDate(value: string): string {
  if (!value) return "Not analyzed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not analyzed";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: SectionIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <CardTitle className="text-sm font-semibold text-slate-950">{title}</CardTitle>
      <span title={hint} className="text-slate-400">
        <Info className="size-3.5" aria-hidden="true" />
      </span>
    </div>
  );
}

function EmptyText({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function SectionShell({
  icon,
  title,
  hint,
  description,
  children,
}: {
  icon: SectionIcon;
  title: string;
  hint: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/60">
        <SectionTitle icon={icon} title={title} hint={hint} />
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function VisualListGrid({
  items,
  empty,
  columns = "sm:grid-cols-2",
}: {
  items: string[];
  empty: string;
  columns?: string;
}) {
  if (items.length === 0) return <EmptyText>{empty}</EmptyText>;
  return (
    <ul className={cn("grid gap-2", columns)}>
      {items.map((item) => (
        <li
          key={item}
          className="flex min-h-12 items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-snug text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
        >
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-700" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InsightTile({
  icon: Icon,
  label,
  value,
  accent = "blue",
}: {
  icon: SectionIcon;
  label: string;
  value: string;
  accent?: "blue" | "emerald" | "amber" | "slate";
}) {
  const accentClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full border",
            accentClasses[accent]
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

function AnalysisMetric({
  icon: Icon,
  label,
  value,
  accent = "slate",
}: {
  icon: SectionIcon;
  label: string;
  value: string;
  accent?: "blue" | "emerald" | "amber" | "slate";
}) {
  return <InsightTile icon={Icon} label={label} value={value} accent={accent} />;
}

function CompactBadgeList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyText>{empty}</EmptyText>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
        >
          <span className="size-1.5 rounded-full bg-blue-700" aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

function TextEditor({
  value,
  rows = 4,
  onChange,
}: {
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <Textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="resize-y bg-white text-sm"
    />
  );
}

function ListEditor({
  value,
  rows = 5,
  onChange,
}: {
  value: string[];
  rows?: number;
  onChange: (value: string[]) => void;
}) {
  return (
    <Textarea
      value={listToLines(value)}
      rows={rows}
      onChange={(event) => onChange(linesToList(event.target.value))}
      className="resize-y bg-white text-sm"
      placeholder="One item per line"
    />
  );
}

export function CompanyBioForm({
  workspaceId,
  workspaceSlug,
  initialProfile,
  activePromptsCount,
  analysisError,
}: Props) {
  const [profile, setProfile] = useState(() => cloneProfile(initialProfile));
  const [editing, setEditing] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const busy = isGenerating || isSaving;

  function update(mutator: (draft: CompanyBioProfile) => void) {
    setProfile((current) => {
      const draft = cloneProfile(current);
      mutator(draft);
      return draft;
    });
  }

  function handleGenerate() {
    startGenerating(async () => {
      const result = await extractBrandProfileAction(workspaceId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudo generar la Company Bio");
        return;
      }
      setProfile(cloneProfile(result.data));
      setEditing(false);
      toast.success("Company Bio generada y guardada");
    });
  }

  function handleSave() {
    startSaving(async () => {
      const result = await saveCompanyBioProfileAction(workspaceId, profile);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudo guardar la Company Bio");
        return;
      }
      setProfile(cloneProfile(result.data));
      setEditing(false);
      toast.success("Company Bio guardada");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-18 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5">
                {/* biome-ignore lint/performance/noImgElement: logo local en public/ para Company Bio */}
                <img
                  src="/brand-logos/air-europa.png"
                  alt={`${profile.company.name || "Air Europa"} logo`}
                  className="size-full object-contain"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {editing ? (
                    <Input
                      value={profile.company.name}
                      onChange={(event) =>
                        update((draft) => {
                          draft.company.name = event.target.value;
                        })
                      }
                      className="h-9 w-64 bg-white text-xl font-bold"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold leading-tight text-slate-950">
                      {profile.company.name}
                    </h2>
                  )}
                  <Globe2 className="size-4 text-blue-700" aria-hidden="true" />
                  {editing ? (
                    <Input
                      value={profile.company.website}
                      onChange={(event) =>
                        update((draft) => {
                          draft.company.website = event.target.value;
                          draft.analysisInfo.sourceUrl = event.target.value;
                        })
                      }
                      className="h-8 w-72 bg-white text-sm"
                    />
                  ) : (
                    <a
                      href={profile.company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium text-blue-700 hover:underline"
                    >
                      {profile.company.website || "No website configured"}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {safe(profile.company.category) && (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      <Building2 className="size-3" aria-hidden="true" />
                      {safe(profile.company.category)}
                    </Badge>
                  )}
                  {safe(profile.company.industry) && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      {safe(profile.company.industry)}
                    </Badge>
                  )}
                  {safe(profile.company.geography) && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      <MapPin className="size-3" aria-hidden="true" />
                      {safe(profile.company.geography)}
                    </Badge>
                  )}
                </div>
                {editing && (
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      value={safe(profile.company.category)}
                      placeholder="Category"
                      onChange={(event) =>
                        update((draft) => {
                          draft.company.category = event.target.value || null;
                        })
                      }
                    />
                    <Input
                      value={safe(profile.company.industry)}
                      placeholder="Industry"
                      onChange={(event) =>
                        update((draft) => {
                          draft.company.industry = event.target.value || null;
                        })
                      }
                    />
                    <Input
                      value={safe(profile.company.geography)}
                      placeholder="Geography"
                      onChange={(event) =>
                        update((draft) => {
                          draft.company.geography = event.target.value || null;
                        })
                      }
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/${workspaceSlug}/dashboard`} />}
                  >
                    <Grid2X2 className="size-4" aria-hidden="true" />
                    View Dashboard
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    nativeButton={false}
                    render={<Link href={`/${workspaceSlug}/prompts`} />}
                  >
                    See AI mentions
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing((value) => !value)}
                disabled={busy}
              >
                <Pencil className="size-4" aria-hidden="true" />
                {editing ? "Cancel edit" : "Edit"}
              </Button>
              {editing && (
                <Button type="button" onClick={handleSave} disabled={busy}>
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save
                </Button>
              )}
              <Button
                type="button"
                className="bg-blue-700 text-white hover:bg-blue-800"
                onClick={handleGenerate}
                disabled={busy || !profile.company.website}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                Generate from URL
              </Button>
            </div>
          </div>
          {analysisError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Latest analysis error: {analysisError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalysisMetric
          icon={BarChart3}
          label="Confidence"
          value={profile.analysisInfo.confidence}
          accent={
            profile.analysisInfo.confidence === "high"
              ? "emerald"
              : profile.analysisInfo.confidence === "medium"
                ? "amber"
                : "slate"
          }
        />
        <AnalysisMetric
          icon={CalendarDays}
          label="Analyzed"
          value={formatDate(profile.analysisInfo.analyzedAt)}
          accent="blue"
        />
        <AnalysisMetric
          icon={Boxes}
          label="Products"
          value={String(profile.productsServices.length)}
          accent="slate"
        />
        <AnalysisMetric
          icon={Bolt}
          label="Key Features"
          value={String(profile.keyFeatures.length)}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.9fr)]">
        <div className="space-y-6">
          <SectionShell
            icon={Globe2}
            title="Business Overview"
            hint="AI-extracted business intelligence"
            description="AI-extracted business intelligence"
          >
            <div className="space-y-5">
              {editing ? (
                <TextEditor
                  value={profile.businessOverview.summary}
                  rows={5}
                  onChange={(value) =>
                    update((draft) => {
                      draft.businessOverview.summary = value;
                    })
                  }
                />
              ) : (
                <p className="text-sm leading-7 text-slate-700">
                  {profile.businessOverview.summary}
                </p>
              )}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-700">
                  <Star className="size-4 text-blue-700" aria-hidden="true" />
                  Value Proposition
                </div>
                {editing ? (
                  <TextEditor
                    value={profile.businessOverview.valueProposition ?? ""}
                    rows={3}
                    onChange={(value) =>
                      update((draft) => {
                        draft.businessOverview.valueProposition = value || null;
                      })
                    }
                  />
                ) : profile.businessOverview.valueProposition ? (
                  <p className="text-sm leading-6 text-slate-700">
                    {profile.businessOverview.valueProposition}
                  </p>
                ) : (
                  <EmptyText>
                    Generate from URL to derive a passenger-focused value proposition.
                  </EmptyText>
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell
            icon={DollarSign}
            title="Business Model & Revenue"
            hint="Pricing strategy and revenue signals"
          >
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">
                  Pricing Strategy
                </h3>
                {editing ? (
                  <TextEditor
                    value={profile.businessModelRevenue.pricingStrategy ?? ""}
                    rows={3}
                    onChange={(value) =>
                      update((draft) => {
                        draft.businessModelRevenue.pricingStrategy = value || null;
                      })
                    }
                  />
                ) : profile.businessModelRevenue.pricingStrategy ? (
                  <p className="text-sm leading-6 text-slate-700">
                    {profile.businessModelRevenue.pricingStrategy}
                  </p>
                ) : (
                  <EmptyText>Generate from URL to infer the airline pricing strategy.</EmptyText>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">Revenue Streams</h3>
                {editing ? (
                  <ListEditor
                    value={profile.businessModelRevenue.revenueStreams}
                    onChange={(value) =>
                      update((draft) => {
                        draft.businessModelRevenue.revenueStreams = value;
                      })
                    }
                  />
                ) : (
                  <VisualListGrid
                    items={profile.businessModelRevenue.revenueStreams}
                    empty="Generate from URL to infer airline revenue streams."
                  />
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell
            icon={Layers}
            title="Technology & Partnerships"
            hint="Detected technology and partnership signals"
          >
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">
                  Technology Stack
                </h3>
                {editing ? (
                  <ListEditor
                    value={profile.technologyPartnerships.technologyStack}
                    onChange={(value) =>
                      update((draft) => {
                        draft.technologyPartnerships.technologyStack = value;
                      })
                    }
                  />
                ) : (
                  <VisualListGrid
                    items={profile.technologyPartnerships.technologyStack}
                    empty="No public technology stack was detected in the analyzed pages."
                    columns="sm:grid-cols-2"
                  />
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">
                  Key Partnerships
                </h3>
                {editing ? (
                  <ListEditor
                    value={profile.technologyPartnerships.keyPartnerships}
                    onChange={(value) =>
                      update((draft) => {
                        draft.technologyPartnerships.keyPartnerships = value;
                      })
                    }
                  />
                ) : (
                  <CompactBadgeList
                    items={profile.technologyPartnerships.keyPartnerships}
                    empty="Generate from URL to detect or qualify partnerships."
                  />
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell
            icon={ShieldCheck}
            title="User Experience & Content"
            hint="Passenger experience and content strategy signals"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">User Experience</h3>
                {editing ? (
                  <TextEditor
                    value={profile.userExperienceContent.userExperience ?? ""}
                    rows={3}
                    onChange={(value) =>
                      update((draft) => {
                        draft.userExperienceContent.userExperience = value || null;
                      })
                    }
                  />
                ) : profile.userExperienceContent.userExperience ? (
                  <p className="text-sm leading-6 text-slate-700">
                    {profile.userExperienceContent.userExperience}
                  </p>
                ) : (
                  <EmptyText>Generate from URL to derive passenger experience signals.</EmptyText>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">
                  Content Strategy
                </h3>
                {editing ? (
                  <TextEditor
                    value={profile.userExperienceContent.contentStrategy ?? ""}
                    rows={3}
                    onChange={(value) =>
                      update((draft) => {
                        draft.userExperienceContent.contentStrategy = value || null;
                      })
                    }
                  />
                ) : profile.userExperienceContent.contentStrategy ? (
                  <p className="text-sm leading-6 text-slate-700">
                    {profile.userExperienceContent.contentStrategy}
                  </p>
                ) : (
                  <EmptyText>Generate from URL to derive operational content strategy.</EmptyText>
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell
            icon={Users}
            title="Social Proof"
            hint="Alliances, partners and public trust signals"
          >
            {editing ? (
              <ListEditor
                value={profile.socialProof}
                onChange={(value) =>
                  update((draft) => {
                    draft.socialProof = value;
                  })
                }
              />
            ) : (
              <CompactBadgeList
                items={profile.socialProof}
                empty="Generate from URL to detect public proof points."
              />
            )}
          </SectionShell>
        </div>

        <aside className="space-y-6">
          <SectionShell
            icon={Users}
            title="Target Audience"
            hint="Passenger segments and service needs"
          >
            {editing ? (
              <TextEditor
                value={profile.targetAudience}
                rows={9}
                onChange={(value) =>
                  update((draft) => {
                    draft.targetAudience = value;
                  })
                }
              />
            ) : (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-sm leading-7 text-slate-700">{profile.targetAudience}</p>
              </div>
            )}
          </SectionShell>

          <SectionShell
            icon={Boxes}
            title="Products & Services"
            hint="Passenger-facing airline products and services"
          >
            {editing ? (
              <ListEditor
                value={profile.productsServices}
                rows={8}
                onChange={(value) =>
                  update((draft) => {
                    draft.productsServices = value;
                  })
                }
              />
            ) : (
              <VisualListGrid
                items={profile.productsServices}
                empty="Generate from URL to infer passenger products and services."
              />
            )}
          </SectionShell>

          <SectionShell
            icon={Bolt}
            title="Key Features"
            hint="Operationally important passenger features"
          >
            {editing ? (
              <ListEditor
                value={profile.keyFeatures}
                rows={7}
                onChange={(value) =>
                  update((draft) => {
                    draft.keyFeatures = value;
                  })
                }
              />
            ) : (
              <VisualListGrid
                items={profile.keyFeatures}
                empty="Generate from URL to derive key airline features."
              />
            )}
          </SectionShell>

          <SectionShell
            icon={BarChart3}
            title="Analysis Info"
            hint="Latest saved analysis metadata"
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AnalysisMetric
                  icon={CalendarDays}
                  label="Analyzed"
                  value={formatDate(profile.analysisInfo.analyzedAt)}
                  accent="blue"
                />
                <AnalysisMetric
                  icon={Sparkles}
                  label="Active Prompts"
                  value={String(activePromptsCount)}
                  accent="slate"
                />
                <AnalysisMetric
                  icon={BarChart3}
                  label="Confidence"
                  value={profile.analysisInfo.confidence}
                  accent={
                    profile.analysisInfo.confidence === "high"
                      ? "emerald"
                      : profile.analysisInfo.confidence === "medium"
                        ? "amber"
                        : "slate"
                  }
                />
                <AnalysisMetric
                  icon={Globe2}
                  label="Pages"
                  value={String(profile.analysisInfo.pagesAnalyzed.length)}
                  accent="slate"
                />
              </div>
              <div className="pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-700">Pages Analyzed</h3>
                <CompactBadgeList
                  items={profile.analysisInfo.pagesAnalyzed}
                  empty="Generate from URL to store analyzed page references."
                />
              </div>
            </div>
          </SectionShell>
        </aside>
      </div>
    </div>
  );
}
