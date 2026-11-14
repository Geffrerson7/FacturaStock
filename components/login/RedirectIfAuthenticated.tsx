import { redirect } from "next/navigation";

import { getOptionalUser } from "@/src/lib/session";

/**
 * Envía al panel a quien ya tiene una sesión válida. Lee la sesión, así que
 * debe renderizarse dentro de un `<Suspense>`.
 */
export default async function RedirectIfAuthenticated() {
  if (await getOptionalUser()) {
    redirect("/admin/dashboard");
  }

  return null;
}
