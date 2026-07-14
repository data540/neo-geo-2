/**
 * Cuentas super-admin (desarrollo/plataforma). Estas cuentas ven funcionalidades
 * en desarrollo que NO deben ver los usuarios normales — actualmente el MCP.
 * Es un gate por email, independiente del rol de workspace (owner/member).
 */
export const SUPER_ADMIN_EMAILS = ["tester@gmail.com"];

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
