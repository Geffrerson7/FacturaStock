import Link from "next/link";
import Login from "@/components/login/Login";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@heroui/react";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="flex h-screen">
      <div className="w-[60%] bg-linear-to-b from-[#4334eb] to-[#1d118c] text-white flex items-center justify-center">
        <Image
          src="/auth-wallpaper.svg"
          alt="Fondo abstracto tecnológico"
          width={1200}
          height={1400}
          className="object-cover h-full w-full"
          loading="eager"
          unoptimized
        />
      </div>
      <div className="w-[40%] flex flex-col justify-center p-24">
        <div className="mb-24 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo de FacturaStock"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
          <h2 className="text-2xl font-semibold">FacturaStock</h2>
        </div>
        <h3 className="font-semibold text-2xl">¡Bienvenidos de nuevo!</h3>
        <p className="text-gray-600">
          ¿No tienes una cuenta?{" "}
          <Link href="./register" className="font-bold text-black underline">
            Create una cuenta nueva ahora
          </Link>
          , es gratis y solo te tomará menos de un minuto.
        </p>
        <Login />
        <Button className="bg-gray-100 text-black w-full flex justify-center items-center gap-3 mt-2 p-2">
          <FcGoogle /> Iniciar sesión
        </Button>
      </div>
    </main>
  );
}
