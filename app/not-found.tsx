import type { Metadata } from "next";
import Link from "next/link";

import StatusScreen from "@/components/ui/StatusScreen";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <StatusScreen
      fullScreen
      eyebrow="404"
      title="Página no encontrada"
      description="La dirección que abriste no existe o fue movida."
    >
      <Link
        href="/admin/dashboard"
        className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        Ir al panel
      </Link>
    </StatusScreen>
  );
}
