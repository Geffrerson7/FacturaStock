import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

import Login from "@/components/login/Login";
import RedirectIfAuthenticated from "@/components/login/RedirectIfAuthenticated";
import { isSignUpEnabled } from "@/src/lib/auth-policy";
import { isDemoLoginEnabled } from "@/src/lib/demo";

export default function HomePage() {
  const showDemo = isDemoLoginEnabled();

  return (
    <main className="flex h-screen">
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>

      <div className="hidden w-[60%] items-center justify-center bg-linear-to-b from-[#4334eb] to-[#1d118c] text-white lg:flex">
        <Image
          src="/auth-wallpaper.svg"
          alt="Fondo abstracto tecnológico"
          width={1200}
          height={1400}
          className="h-full w-full object-cover"
          loading="eager"
          unoptimized
        />
      </div>
      <div className="flex w-full flex-col justify-center overflow-y-auto p-8 sm:p-12 lg:w-[40%] lg:p-16">
        <div className="mb-10 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo de FacturaStock"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
          <h1 className="text-2xl font-semibold">FacturaStock</h1>
        </div>
        <h2 className="text-2xl font-semibold">¡Bienvenidos de nuevo!</h2>
        {isSignUpEnabled() ? (
          <p className="mt-2 text-gray-600">
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="font-bold text-black underline">
              Crea una cuenta nueva
            </Link>
            , es gratis y solo te tomará menos de un minuto.
          </p>
        ) : (
          <p className="mt-2 text-gray-600">
            {showDemo
              ? "Inicia sesión con tu cuenta o entra con la cuenta de demostración."
              : "Inicia sesión con tu cuenta."}
          </p>
        )}
        <Login showDemo={showDemo} />
      </div>
    </main>
  );
}
