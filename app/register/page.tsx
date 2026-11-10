import Image from "next/image";
import Link from "next/link";
import { Button } from "@heroui/react";
import { FcGoogle } from "react-icons/fc";

import RegisterForm from "@/components/register/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex h-screen">
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

        <h2 className="mt-10 text-2xl font-semibold">Crea tu cuenta</h2>
        <p className="mt-2 text-gray-600">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/" className="font-bold text-black underline">
            Inicia sesión
          </Link>
          , es gratis y solo te tomará menos de un minuto.
        </p>

        <RegisterForm />

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          o
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Button className="flex w-full items-center justify-center gap-3 bg-gray-100 p-2 text-black">
          <FcGoogle /> Registrarse con Google
        </Button>
      </div>
    </main>
  );
}
