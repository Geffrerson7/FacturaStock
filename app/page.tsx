import type { Metadata } from "next";
import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";
import Login from "@/components/login/Login";
import { isSignUpEnabled } from "@/src/lib/auth-policy";
import { isDemoLoginEnabled } from "@/src/lib/demo";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function HomePage() {
  const showDemo = isDemoLoginEnabled();

  return (
    <AuthLayout
      title="Te damos la bienvenida"
      description={
        isSignUpEnabled() ? (
          <>
            ¿No tienes una cuenta?{" "}
            <Link
              href="/register"
              className="font-medium text-link underline underline-offset-2"
            >
              Crea una cuenta nueva
            </Link>
            . Es gratis y toma menos de un minuto.
          </>
        ) : showDemo ? (
          "Inicia sesión con tu cuenta o entra con la cuenta de demostración."
        ) : (
          "Inicia sesión con tu cuenta."
        )
      }
    >
      <Login showDemo={showDemo} />
    </AuthLayout>
  );
}
