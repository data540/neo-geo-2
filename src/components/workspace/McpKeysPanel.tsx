"use client";

import { Check, Copy, KeyRound, Loader2, Plug, ShieldAlert, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  generateMcpKeyAction,
  type McpConnectionRow,
  type McpKeyRow,
  revokeMcpConnectionAction,
  revokeMcpKeyAction,
} from "@/actions/mcp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Props {
  workspaceId: string;
  workspaceName: string;
  serverUrl: string;
  initialKeys: McpKeyRow[];
  initialConnections: McpConnectionRow[];
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(`${label} copiado`);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      Copiar
    </Button>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function McpKeysPanel({
  workspaceId,
  workspaceName,
  serverUrl,
  initialKeys,
  initialConnections,
}: Props) {
  const [keys, setKeys] = useState<McpKeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevoking, startRevoking] = useTransition();

  const [connections, setConnections] = useState<McpConnectionRow[]>(initialConnections);
  const [revokingConnectionId, setRevokingConnectionId] = useState<string | null>(null);
  const [isRevokingConnection, startRevokingConnection] = useTransition();

  function handleGenerate() {
    startGenerating(async () => {
      const result = await generateMcpKeyAction(workspaceId, name);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "No se pudo generar la key");
        return;
      }
      const { key, keyPrefix } = result.data;
      setFreshKey(key);
      setKeys((prev) => [
        {
          id: crypto.randomUUID(),
          name: name.trim() || "default",
          keyPrefix,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          revokedAt: null,
        },
        ...prev,
      ]);
      setName("");
      toast.success("API key creada");
    });
  }

  function handleRevoke(id: string) {
    setRevokingId(id);
    startRevoking(async () => {
      const result = await revokeMcpKeyAction(id);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo revocar");
        setRevokingId(null);
        return;
      }
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k))
      );
      setRevokingId(null);
      toast.success("Key revocada");
    });
  }

  function handleRevokeConnection(id: string) {
    setRevokingConnectionId(id);
    startRevokingConnection(async () => {
      const result = await revokeMcpConnectionAction(id);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo revocar");
        setRevokingConnectionId(null);
        return;
      }
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, revokedAt: new Date().toISOString() } : c))
      );
      setRevokingConnectionId(null);
      toast.success("Conexión revocada");
    });
  }

  const claudeSnippet = `claude mcp add --transport http mentio ${serverUrl} \\\n  --header "Authorization: Bearer ${freshKey ?? "mnt_live_TU_KEY"}"`;

  return (
    <div className="space-y-6">
      {/* Conexión */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Plug className="size-4 text-indigo-600" aria-hidden="true" />
            Servidor MCP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              URL del servidor
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {serverUrl}
              </code>
              <CopyButton value={serverUrl} label="URL" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Configúralo en Claude o ChatGPT con esta URL y una API key como Bearer token. Todas las
            respuestas quedan acotadas al workspace <strong>{workspaceName}</strong> (solo lectura).
          </p>
        </CardContent>
      </Card>

      {/* Generar key */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <KeyRound className="size-4 text-indigo-600" aria-hidden="true" />
            Generar API key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              placeholder="Nombre (ej: Claude Desktop de David)"
              onChange={(e) => setName(e.target.value)}
              className="bg-white"
            />
            <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              Generar
            </Button>
          </div>

          {freshKey && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Copia esta key ahora: <strong>solo se muestra una vez</strong>. Después solo queda
                  guardado su hash.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900">
                  {freshKey}
                </code>
                <CopyButton value={freshKey} label="API key" />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Ejemplo para Claude Code
                </p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 overflow-x-auto rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800">
                    {claudeSnippet}
                  </pre>
                  <CopyButton value={claudeSnippet} label="Comando" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listado */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="text-sm font-semibold text-slate-950">
            API keys ({keys.filter((k) => !k.revokedAt).length} activas)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Aún no hay keys. Genera una arriba para conectar un LLM.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{k.name}</span>
                      {k.revokedAt ? (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                          Revocada
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          Activa
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      <code>{k.keyPrefix}…</code> · creada {formatDate(k.createdAt)} · último uso{" "}
                      {formatDate(k.lastUsedAt)}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(k.id)}
                      disabled={isRevoking && revokingId === k.id}
                    >
                      {isRevoking && revokingId === k.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      Revocar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Conexiones OAuth */}
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="text-sm font-semibold text-slate-950">
            Conexiones OAuth ({connections.filter((c) => !c.revokedAt).length} activas)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {connections.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Aún no hay conexiones OAuth. Se crean automáticamente al autorizar un cliente MCP.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {c.clientName ?? "Cliente sin nombre"}
                      </span>
                      {c.revokedAt ? (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                          Revocada
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          Activa
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      creada {formatDate(c.createdAt)} · último uso {formatDate(c.lastUsedAt)}
                    </p>
                  </div>
                  {!c.revokedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeConnection(c.id)}
                      disabled={isRevokingConnection && revokingConnectionId === c.id}
                    >
                      {isRevokingConnection && revokingConnectionId === c.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      Revocar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
