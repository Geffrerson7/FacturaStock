import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

/**
 * Envío de correos transaccionales con Resend. Solo se usa en el servidor.
 *
 * Variables de entorno: `RESEND_API_KEY` (sin ella no se envía nada) y
 * `RESEND_FROM_EMAIL` (remitente; debe ser de un dominio verificado en Resend).
 * Sin `RESEND_FROM_EMAIL` se usa `onboarding@resend.dev`, que Resend solo deja
 * enviar al correo dueño de la cuenta: sirve para probar, no para producción.
 */

const DEFAULT_FROM = "FacturaStock <onboarding@resend.dev>";
const SEND_TIMEOUT_MS = 5000;
const WELCOME_TEMPLATE_PATH = path.join(
  process.cwd(),
  "email",
  "welcome-email.html",
);

let resendClient: Resend | null = null;
let welcomeTemplate: Promise<string> | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

function loadWelcomeTemplate(): Promise<string> {
  welcomeTemplate ??= readFile(WELCOME_TEMPLATE_PATH, "utf8").catch(
    (error: unknown) => {
      // Si falla la lectura, el siguiente intento vuelve a leer el archivo.
      welcomeTemplate = null;
      throw error;
    },
  );
  return welcomeTemplate;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Sustituye cada `{{clave}}` por su valor escapado; las claves desconocidas quedan vacías. */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    escapeHtml(values[key] ?? ""),
  );
}

function getAppUrl(): string {
  return (process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

type WelcomeRecipient = { name: string; email: string };

/**
 * Envía el correo de bienvenida a un usuario recién registrado. Nunca lanza:
 * un fallo del correo no debe deshacer ni bloquear el registro.
 */
export async function sendWelcomeEmail(user: WelcomeRecipient): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY no está definida; no se envía el correo de bienvenida.",
    );
    return;
  }

  try {
    const template = await loadWelcomeTemplate();
    const name = user.name.trim() || user.email;
    const html = renderTemplate(template, {
      name,
      email: user.email,
      appUrl: getAppUrl(),
      year: String(new Date().getFullYear()),
    });

    const { error } = await resend.emails.send(
      {
        from: process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM,
        to: user.email,
        subject: "¡Bienvenido a FacturaStock!",
        html,
      },
      { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
    );

    if (error) {
      console.error("[email] Resend rechazó el correo de bienvenida:", error);
    }
  } catch (error) {
    console.error("[email] No se pudo enviar el correo de bienvenida:", error);
  }
}
