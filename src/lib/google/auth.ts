import { google } from "googleapis";

// Cliente JWT de la Service Account global. La misma cuenta de servicio debe
// tener acceso de lectura en cada propiedad de Search Console y GA4 (se concede
// manualmente añadiendo su client_email como usuario).
//
// Variables requeridas:
//   GOOGLE_SA_CLIENT_EMAIL
//   GOOGLE_SA_PRIVATE_KEY  (con \n literales escapados)

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;

export function getGoogleAuth(): InstanceType<typeof google.auth.JWT> {
  if (cachedAuth) return cachedAuth;

  const email = process.env.GOOGLE_SA_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Faltan GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY. La integración con Google requiere una Service Account."
    );
  }

  cachedAuth = new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
  });

  return cachedAuth;
}

export function hasGoogleServiceAccount(): boolean {
  return !!process.env.GOOGLE_SA_CLIENT_EMAIL?.trim() && !!process.env.GOOGLE_SA_PRIVATE_KEY?.trim();
}
