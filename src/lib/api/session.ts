import { auth } from "@/src/lib/auth";
import {
  canUseMethod,
  DEMO_READ_ONLY_MESSAGE,
  type SessionUser,
  USER_ROLES,
  type UserRole,
} from "@/src/lib/auth-policy";

import { ApiError } from "./errors";

type RequireSessionOptions = {
  /**
   * Con `false`, el usuario de demostración recibe 403 aunque la petición sea
   * GET. Sirve para los endpoints de lectura que gastan servicios de pago.
   */
  allowDemo?: boolean;
};

function toRole(value: unknown): UserRole {
  // Un rol desconocido se trata como el de menos permisos.
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "DEMO";
}

/** Lee la sesión de las cabeceras. Devuelve `null` si no hay sesión válida. */
export async function getSessionUser(
  headers: Headers,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });

  if (!session) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: toRole(session.user.role),
  };
}

/**
 * Exige una sesión válida en un Route Handler. Debe ser la primera llamada
 * de cada handler protegido.
 *
 * - Sin sesión: 401 `UNAUTHENTICATED`.
 * - Usuario de demostración en una petición que no es GET: 403 `DEMO_READ_ONLY`.
 */
export async function requireSession(
  request: Request,
  { allowDemo = true }: RequireSessionOptions = {},
): Promise<SessionUser> {
  const user = await getSessionUser(request.headers);

  if (!user) {
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Debes iniciar sesión para continuar.",
    );
  }

  if (
    !canUseMethod(user.role, request.method) ||
    (user.role === "DEMO" && !allowDemo)
  ) {
    throw new ApiError(403, "DEMO_READ_ONLY", DEMO_READ_ONLY_MESSAGE);
  }

  return user;
}
