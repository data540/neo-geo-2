import { createHash, randomBytes } from "node:crypto";
import { hashApiKey } from "@/lib/mcp/auth";

export const ACCESS_PREFIX = "mnt_at_";
export const REFRESH_PREFIX = "mnt_rt_";
export const CODE_PREFIX = "mnt_ac_";

export const ACCESS_TTL_SECONDS = 3600; // 1h
export const CODE_TTL_SECONDS = 60; // 1min

/** Base pública del servidor OAuth/MCP, sin barra final. */
export function oauthBaseUrl(): string {
  const base = process.env.MCP_PUBLIC_BASE_URL ?? "https://neogeo-three.vercel.app";
  return base.replace(/\/$/, "");
}

/** Genera un token/código opaco con prefijo y su hash sha256. El valor en claro no se persiste. */
export function generateOpaqueToken(prefix: string): { token: string; hash: string } {
  const secret = randomBytes(24).toString("hex"); // 48 chars
  const token = `${prefix}${secret}`;
  return { token, hash: hashApiKey(token) };
}

/** Verifica PKCE S256: base64url(sha256(code_verifier)) === code_challenge. */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}
