import type { Metadata } from "next";
import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";
import RegisterForm from "@/components/register/RegisterForm";
import { isSignUpEnabled } from "@/src/lib/auth-policy";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

const LINK_CLASS = "font-medium text-link underline underline-offset-2";

export default function RegisterPage() {
  if (!isSignUpEnabled()) {
    return (
      <AuthLayout
        title="El registro está cerrado"
        description={
          <>
            Esta instalación no admite cuentas nuevas. Vuelve a la pantalla de{" "}
            <Link href="/" className={LINK_CLASS}>
              inicio de sesión
            </Link>
            .
          </>
        }
      />
    );
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      description={
        <>
          Es gratis y toma menos de un minuto. ¿Ya tienes una cuenta?{" "}
          <Link href="/" className={LINK_CLASS}>
            Inicia sesión
          </Link>
          .
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
