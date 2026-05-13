"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createPromptsBulkAction } from "@/actions/prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  workspaceId: string;
  workspaceCountry: string;
}

const COUNTRIES = [
  { code: "ES", name: "Espana" },
  { code: "CO", name: "Colombia" },
];

function parseCsvLike(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const joined = lines.join("\n");
  const hasSeparators = /[,;\t]/.test(joined);
  if (!hasSeparators) return lines;

  const candidates: string[] = [];
  for (const line of lines) {
    const cols = line.split(/[;,\t]/).map((c) => c.trim());
    const promptCol = cols.find(
      (c) => c.length >= 10 && /\?|aeroline|vuelo|equipaje|check|cancel/i.test(c)
    );
    if (promptCol) candidates.push(promptCol);
  }
  return candidates.length > 0 ? candidates : lines;
}

export function BulkUploadPromptsButton({ workspaceId, workspaceCountry }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(workspaceCountry);
  const [plainText, setPlainText] = useState("");
  const [parsedFromFile, setParsedFromFile] = useState<string[]>([]);

  const previewPrompts = useMemo(() => {
    const typed = parseCsvLike(plainText);
    return Array.from(
      new Set([...parsedFromFile, ...typed].map((p) => p.trim()).filter(Boolean))
    ).slice(0, 200);
  }, [plainText, parsedFromFile]);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();

    try {
      if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const content = await file.text();
        setParsedFromFile(parseCsvLike(content));
        return;
      }

      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("No se encontro ninguna hoja en el Excel");
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("No se pudo leer la hoja del Excel");
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          raw: false,
        });

        const prompts: string[] = [];
        for (const row of rows) {
          const values = row
            .map((v) => String(v ?? "").trim())
            .filter(Boolean)
            .filter((v) => v.length >= 10);
          const prompt =
            values.find((v) => /\?|aeroline|vuelo|equipaje|check|cancel/i.test(v)) ?? values[0];
          if (prompt) prompts.push(prompt);
        }

        setParsedFromFile(prompts);
        return;
      }

      toast.error("Formato no soportado. Usa CSV, Excel o TXT.");
    } catch {
      toast.error("No se pudo leer el archivo seleccionado");
    }
  }

  async function handleImport() {
    setLoading(true);
    const result = await createPromptsBulkAction({
      workspaceId,
      country,
      prompts: previewPrompts,
    });

    if (result.success) {
      toast.success(`Importados ${result.data?.created ?? 0} prompts`);
      setOpen(false);
      setPlainText("");
      setParsedFromFile([]);
    } else {
      toast.error(result.error ?? "No se pudieron importar los prompts");
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
        <FileUp className="w-4 h-4" />
        Subida masiva
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar prompts</DialogTitle>
          <DialogDescription>
            Acepta CSV, Excel o texto plano. Puedes cargar archivo, pegar texto o combinar ambos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="country-bulk">Pais</Label>
              <Select
                value={country}
                onValueChange={(value) => setCountry(value ?? workspaceCountry)}
              >
                <SelectTrigger id="country-bulk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-file">Archivo</Label>
              <input
                id="bulk-file"
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-text">Texto plano (una linea por prompt o CSV pegado)</Label>
            <Textarea
              id="bulk-text"
              rows={8}
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              placeholder="Ejemplo:\nQue aerolinea conviene para volar Madrid-Bogota con equipaje facturado?\nComo comparar opciones Madrid-Miami sin escalas largas?"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">
              Preview ({previewPrompts.length} prompt{previewPrompts.length !== 1 ? "s" : ""})
            </p>
            <div className="max-h-44 overflow-auto space-y-1">
              {previewPrompts.length === 0 ? (
                <p className="text-xs text-slate-400">Aun no hay prompts detectados.</p>
              ) : (
                previewPrompts.slice(0, 25).map((p, i) => (
                  <p key={p} className="text-xs text-slate-700">
                    {i + 1}. {p}
                  </p>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={loading || previewPrompts.length === 0}
              onClick={handleImport}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar prompts"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
