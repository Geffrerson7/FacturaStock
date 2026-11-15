import { Suspense } from "react";
import Image from "next/image";

import RedirectIfAuthenticated from "@/components/login/RedirectIfAuthenticated";
import Brand from "@/components/ui/Brand";

type AuthLayoutProps = {
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Composición compartida por el inicio de sesión y el registro: la
 * ilustración cubre toda la pantalla y el formulario va en una tarjeta
 * centrada encima.
 */
export default function AuthLayout({
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-linear-to-b from-brand to-brand-strong px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>

      <Image
        src="/auth-wallpaper.svg"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="object-cover"
        loading="eager"
        unoptimized
      />

      <div className="relative w-full max-w-md rounded-3xl bg-surface p-6 shadow-overlay sm:p-10">
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {children}
      </div>
    </main>
  );
}
