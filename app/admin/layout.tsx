import { Suspense } from "react";

import AdminShell from "@/components/admin/AdminShell";
import AdminShellSkeleton from "@/components/admin/AdminShellSkeleton";
import { getCurrentUser } from "@/src/lib/session";

export default function Layout({ children }: LayoutProps<"/admin">) {
  // La sesión se lee en cada petición, así que todo el panel queda detrás de
  // un Suspense: nada de /admin se renderiza hasta validar la sesión.
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AuthenticatedPanel>{children}</AuthenticatedPanel>
    </Suspense>
  );
}

async function AuthenticatedPanel({ children }: { children: React.ReactNode }) {
  // Redirige al login si la sesión no existe o ya venció.
  const user = await getCurrentUser();

  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </AdminShell>
  );
}
