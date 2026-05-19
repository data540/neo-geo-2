"use client";

import { Download, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { exportDashboardAction } from "@/actions/dashboard-export";
import { Button } from "@/components/ui/button";

interface Props {
  workspaceSlug: string;
  days: number;
  llmKey: string | null;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function ExportDashboardButton({ workspaceSlug, days, llmKey }: Props) {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const res = await exportDashboardAction(workspaceSlug, days, llmKey);
      if (!res.success || !res.data) {
        toast.error(res.error ?? "No se pudo generar el archivo");
        return;
      }
      const blob = base64ToBlob(
        res.data.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    });
  }

  return (
    <Button
      type="button"
      onClick={handleExport}
      disabled={pending}
      variant="outline"
      className="gap-1.5"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Exportar Excel
    </Button>
  );
}
