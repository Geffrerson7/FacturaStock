import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

import RedirectIfAuthenticated from "@/components/login/RedirectIfAuthenticated";
import RegisterForm from "@/components/register/RegisterForm";
import { isSignUpEnabled } from "@/src/lib/auth-policy";

export default function RegisterPage() {
  const signUpEnabled = isSignUpEnabled();

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
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo de FacturaStock"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
          <h1 className="text-2xl font-semibold">FacturaStock</h1>
        </div>

        {signUpEnabled ? (
          <>
            <h2 className="mt-10 text-2xl font-semibold">Crea tu cuenta</h2>
            <p className="mt-2 text-gray-600">
              Es gratis y solo te tomará menos de un minuto. ¿Ya tienes una
              cuenta?{" "}
              <Link href="/" className="font-bold text-black underline">
                Inicia sesión
              </Link>
              .
            </p>

            <RegisterForm />
          </>
        ) : (
          <>
            <h2 className="mt-10 text-2xl font-semibold">
              El registro está cerrado
            </h2>
            <p className="mt-2 text-gray-600">
              Esta instalación no admite cuentas nuevas. Vuelve a la pantalla
              de{" "}
              <Link href="/" className="font-bold text-black underline">
                inicio de sesión
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
