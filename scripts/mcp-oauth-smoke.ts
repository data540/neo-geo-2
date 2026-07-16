import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

async function main() {
  // 1. Metadata
  const meta = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then((r) => r.json());
  console.log("✓ metadata:", meta.authorization_endpoint);
  if (!meta.code_challenge_methods_supported?.includes("S256")) throw new Error("falta S256");

  // 2. Dynamic Client Registration
  const reg = await fetch(`${BASE}/api/mcp/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Smoke", redirect_uris: ["https://example.com/cb"] }),
  }).then((r) => r.json());
  console.log("✓ registro client_id:", reg.client_id);
  if (!reg.client_id) throw new Error("registro falló");

  // 3. PKCE
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const authUrl = `${meta.authorization_endpoint}?response_type=code&client_id=${reg.client_id}&redirect_uri=${encodeURIComponent("https://example.com/cb")}&code_challenge=${challenge}&code_challenge_method=S256&state=xyz`;
  console.log(
    "\n➡  Abre esta URL en el navegador (logueado como owner), autoriza, y copia el ?code= del redirect:"
  );
  console.log("  ", authUrl);
  console.log("\n   Luego intercámbialo:");
  console.log(
    `   curl -s -X POST ${BASE}/api/mcp/oauth/token -d "grant_type=authorization_code&code=EL_CODE&code_verifier=${verifier}&client_id=${reg.client_id}&redirect_uri=https://example.com/cb"`
  );
  console.log("\n   Y prueba el token:");
  console.log(
    `   curl -s -X POST ${BASE}/api/mcp -H "Authorization: Bearer EL_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_workspace_overview","arguments":{}}}'`
  );
}

main().catch((e) => {
  console.error("✗ smoke falló:", e);
  process.exit(1);
});
