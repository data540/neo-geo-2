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

const PROMPT_HEADER_TOKENS = new Set([
  "prompt",
  "prompts",
  "pregunta",
  "preguntas",
  "question",
  "questions",
  "texto",
  "text",
  "contenido",
  "content",
  "mensaje",
  "mensajes",
  "query",
  "consulta",
]);

function normalizeHeaderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'`]/g, "");
}

function isHeaderLikeLine(value: string): boolean {
  const normalized = normalizeHeaderToken(value);
  return PROMPT_HEADER_TOKENS.has(normalized);
}

function isHeaderLikeRow(values: string[]): boolean {
  const meaningful = values.map((value) => value.trim()).filter(Boolean);
  if (meaningful.length === 0) return false;
  return meaningful.every((value) => isHeaderLikeLine(value));
}

function parseCsvLike(text: string): string[] {
  const lines = splitPromptLines(text);

  if (lines.length === 0) return [];

  const joined = lines.join("\n");
  const hasSeparators = /[,;\t]/.test(joined);
  if (!hasSeparators) return lines;

  const candidates: string[] = [];
  for (const [index, line] of lines.entries()) {
    const cols = line.split(/[;,\t]/).map((c) => c.trim());
    if (index === 0 && isHeaderLikeRow(cols)) continue;

    const promptCol = cols
      .filter((c) => c.length > 0)
      .sort((a, b) => b.length - a.length)[0];
    if (promptCol) candidates.push(promptCol);
  }
  return candidates.length > 0 ? candidates : lines;
}

function splitPromptLines(text: string): string[] {
  const hasRealLineBreak = /[\r\n\u2028\u2029]/u.test(text);
  const normalizedText = hasRealLineBreak
    ? text.replace(/\r\n|\r|\u2028|\u2029/gu, "\n")
    : text.replace(/\\r\\n|\\n|\\r/g, "\n");

  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0];
  if (typeof firstLine === "string" && isHeaderLikeLine(firstLine)) {
    return lines.slice(1);
  }

  return lines;
}

export function BulkUploadPromptsButton({ workspaceId, workspaceCountry }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(workspaceCountry);
  const [plainText, setPlainText] = useState("");
  const [parsedFromFile, setParsedFromFile] = useState<string[]>([]);
  const [runAfterImport, setRunAfterImport] = useState(true);
  const [llmKey, setLlmKey] = useState("chatgpt");

  const previewPrompts = useMemo(() => {
    const typed = parseCsvLike(plainText);
    return Array.from(new Set([...parsedFromFile, ...typed].map((p) => p.trim()).filter(Boolean)));
  }, [plainText, parsedFromFile]);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();

    try {
      if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const content = await file.text();
        if (name.endsWith(".txt")) {
          setParsedFromFile(splitPromptLines(content));
        } else {
          setParsedFromFile(parseCsvLike(content));
        }
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
        for (const [index, row] of rows.entries()) {
          const values = row
            .map((v) => String(v ?? "").trim())
            .filter(Boolean);

          if (index === 0 && isHeaderLikeRow(values)) continue;

          const prompt = values[0];
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
      rawText: plainText,
      runAfterImport,
      llmKey,
    });

    if (result.success) {
      const created = result.data?.created ?? 0;
      const queued = result.data?.queued ?? 0;
      toast.success(
        runAfterImport
          ? `Importados ${created} prompts y encolados ${queued} runs`
          : `Importados ${created} prompts`
      );
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
      <DialogTrigger
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
      >
        <FileUp className="w-4 h-4" />
        Subida masiva
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar prompts</DialogTitle>
          <DialogDescription>
            Acepta CSV, Excel o texto plano. Puedes cargar archivo, pegar texto o combinar ambos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
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

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={runAfterImport}
                onChange={(e) => setRunAfterImport(e.target.checked)}
              />
              Importar y ejecutar automáticamente
            </label>
            {runAfterImport && (
              <div className="space-y-1.5">
                <Label htmlFor="llm-bulk-run">LLM para ejecución</Label>
                <Select value={llmKey} onValueChange={(value) => setLlmKey(value ?? "chatgpt")}>
                  <SelectTrigger id="llm-bulk-run">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chatgpt">ChatGPT</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="perplexity">Perplexity</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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

          <div className="flex justify-end gap-2 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
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
