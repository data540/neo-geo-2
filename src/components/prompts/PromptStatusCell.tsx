"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { RunStatus } from "@/types";

interface Props {
  status: RunStatus | null;
}

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
  queued: { label: "En cola", className: "bg-slate-100 text-slate-600" },
  running: { label: "Ejecutando", className: "bg-blue-100 text-blue-700 animate-pulse" },
  completed: { label: "Completado", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Fallido", className: "bg-red-100 text-red-700" },
};

export function PromptStatusCell({ status }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status === "queued" || status === "running") {
      const t = setTimeout(() => router.refresh(), 2000);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (!status) {
    return <span className="text-slate-400 text-xs">—</span>;
  }

  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
