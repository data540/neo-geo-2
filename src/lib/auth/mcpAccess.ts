/**
 * Bloqueo temporal de acceso a MCP para cuentas específicas, "hasta nueva orden".
 * Es un gate por email, independiente del rol de workspace (owner/admin).
 * Para restaurar el acceso, quitar el email de esta lista.
 */
export const MCP_BLOCKED_EMAILS = ["foodbox@neogeo.app"];

export function isMcpBlocked(email: string | null | undefined): boolean {
  return !!email && MCP_BLOCKED_EMAILS.includes(email.trim().toLowerCase());
}
