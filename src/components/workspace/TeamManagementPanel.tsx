"use client";

import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWorkspaceAction, inviteWorkspaceMemberByEmailAction } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMemberRole } from "@/types";

interface MemberRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: WorkspaceMemberRole;
  createdAt: string;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  currentRole: WorkspaceMemberRole;
  members: MemberRow[];
}

export function TeamManagementPanel({
  workspaceId,
  workspaceSlug,
  workspaceName,
  currentRole,
  members,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [email, setEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const canManage = currentRole === "owner" || currentRole === "admin";
  const canDelete = currentRole === "owner";

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("email", email);
      fd.set("role", role);

      const result = await inviteWorkspaceMemberByEmailAction(fd);
      if (result.success) {
        toast.success("Colaborador anadido al team");
        setEmail("");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo anadir el colaborador");
      }
    });
  }

  async function handleDeleteWorkspace() {
    if (!canDelete) return;
    setDeletePending(true);
    const result = await deleteWorkspaceAction({
      workspaceId,
      workspaceSlug,
      confirmationText: confirmText,
    });
    setDeletePending(false);

    if (result.success) {
      toast.success("Workspace eliminado correctamente");
      router.replace("/workspaces");
      router.refresh();
      window.location.assign("/workspaces");
    } else {
      toast.error(result.error ?? "No se pudo eliminar el workspace");
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Miembros del team</h2>
          <p className="text-xs text-slate-500 mt-1">
            Roles: owner/admin pueden gestionar; member/viewer solo consulta.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
                  Nombre
                </th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-slate-500">
                  Rol
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-slate-50">
                  <td className="px-3 py-2 text-slate-700">{m.email || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{m.fullName || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Invitar colaborador</h2>
        <form
          onSubmit={handleInvite}
          className="grid gap-3 sm:grid-cols-[1fr_180px_auto] items-end"
        >
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@empresa.com"
              disabled={!canManage || pending}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole((value as "admin" | "member" | "viewer" | null) ?? "member")
              }
            >
              <SelectTrigger disabled={!canManage || pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!canManage || pending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Invitar
          </Button>
        </form>
      </section>

      <section className="bg-white border border-red-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-red-700">Zona de riesgo</h2>
        <p className="text-sm text-slate-600">
          Eliminaras <span className="font-medium">{workspaceName}</span> con todos sus prompts,
          runs y metricas.
        </p>
        <div className="space-y-1">
          <Label htmlFor="confirm-workspace">Escribe el slug para confirmar</Label>
          <Input
            id="confirm-workspace"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspaceSlug}
            disabled={!canDelete || deletePending}
          />
        </div>
        <Button
          variant="destructive"
          onClick={handleDeleteWorkspace}
          disabled={
            !canDelete ||
            deletePending ||
            confirmText.trim().toLowerCase() !== workspaceSlug.toLowerCase()
          }
        >
          {deletePending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Eliminar workspace
        </Button>
      </section>
    </div>
  );
}
