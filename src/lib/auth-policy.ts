/**
 * Reglas de acceso que no dependen de la base ni de Better Auth, para poder
 * probarlas y reutilizarlas en el servidor y en el cliente.
 */

export const USER_ROLES = ["ADMIN", "DEMO"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export const DEMO_READ_ONLY_MESSAGE =
  "El usuario de demostración solo tiene permisos de lectura.";

const READ_METHODS = new Set(["GET", "HEAD"]);

/** Los métodos que no modifican datos ni gastan servicios de terceros. */
export function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method.toUpperCase());
}

/** El usuario de demostración solo puede hacer peticiones de lectura. */
export function canUseMethod(role: UserRole, method: string): boolean {
  return role !== "DEMO" || isReadMethod(method);
}

export function isSignUpEnabled(): boolean {
  return process.env.AUTH_ALLOW_SIGNUP === "true";
}

/**
 * Endpoints de Better Auth que la aplicación expone. El resto (cambio de
 * contraseña, de correo, borrado de cuenta...) responde 404: no hay pantalla
 * que los use y, con una cuenta de demostración compartida, cualquiera podría
 * cambiarle la contraseña.
 */
const ALLOWED_AUTH_ROUTES: Record<string, readonly string[]> = {
  GET: ["/get-session", "/ok"],
  POST: ["/sign-in/email", "/sign-up/email", "/sign-out"],
};

export function isAllowedAuthRoute(method: string, pathname: string): boolean {
  const path = pathname.replace(/^\/api\/auth/, "").replace(/\/+$/, "");

  return ALLOWED_AUTH_ROUTES[method.toUpperCase()]?.includes(path) ?? false;
}
