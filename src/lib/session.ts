import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/src/lib/api/session";
import type { SessionUser } from "@/src/lib/auth-policy";

/**
 * Usuario de la sesión para Server Components. Lee las cabeceras de la
 * petición, así que con Cache Components debe llamarse dentro de un
 * `<Suspense>`.
 */
export async function getOptionalUser(): Promise<SessionUser | null> {
  return getSessionUser(await headers());
}

/** Igual que `getOptionalUser`, pero redirige al login si no hay sesión. */
export async function getCurrentUser(): Promise<SessionUser> {
  const user = await getOptionalUser();

  if (!user) redirect("/");

  return user;
}
