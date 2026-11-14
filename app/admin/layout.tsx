import { Suspense } from "react";

import Sidebar from "@/components/admin/Sidebar";
import { getCurrentUser } from "@/src/lib/session";

export default function Layout({ children }: LayoutProps<"/admin">) {
  // La sesión se lee en cada petición, así que todo el panel queda detrás de
  // un Suspense: nada de /admin se renderiza hasta validar la sesión.
  return (
    <Suspense fallback={<PanelFallback />}>
      <AuthenticatedPanel>{children}</AuthenticatedPanel>
    </Suspense>
  );
}

async function AuthenticatedPanel({ children }: { children: React.ReactNode }) {
  // Redirige al login si la sesión no existe o ya venció.
  const user = await getCurrentUser();

  return (
    <section className="flex">
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      {children}
    </section>
  );
}

function PanelFallback() {
  return (
    <div
      role="status"
      className="flex h-screen items-center justify-center text-sm text-slate-500"
    >
      Cargando panel...
    </div>
  );
}
