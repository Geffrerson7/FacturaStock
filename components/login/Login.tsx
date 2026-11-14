"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Label, TextField } from "@heroui/react";

import { authClient } from "@/src/lib/auth-client";

// Tipo del evento que entrega el Form de HeroUI en onSubmit.
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type Source = "form" | "demo";

export default function Login({ showDemo }: { showDemo: boolean }) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("form");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // El botón sigue ocupado mientras dura la petición y la navegación al
  // panel, y se libera solo al terminar: Next conserva el estado de esta
  // pantalla, así que un "pendiente" fijo reaparecería al volver al login.
  const pending = isRequesting || isNavigating ? source : null;

  function start(nextSource: Source) {
    setErrorMessage(null);
    setSource(nextSource);
    setIsRequesting(true);
  }

  function enterPanel() {
    startNavigation(() => {
      router.push("/admin/dashboard");
      router.refresh();
    });
    setIsRequesting(false);
  }

  async function signIn(email: string, password: string) {
    start("form");

    const { error } = await authClient.signIn.email({ email, password });

    if (error) {
      setErrorMessage(
        error.status === 429
          ? "Demasiados intentos. Espera unos segundos y vuelve a probar."
          : error.status === 401
            ? "Correo o contraseña incorrectos."
            : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
      setIsRequesting(false);
      return;
    }

    enterPanel();
  }

  // Las credenciales de demostración viven en el servidor: el navegador solo
  // pide la sesión.
  async function signInAsDemo() {
    start("demo");

    const response = await fetch("/api/auth/demo", { method: "POST" }).catch(
      () => null,
    );

    if (!response?.ok) {
      setErrorMessage("No se pudo entrar con la cuenta de demostración.");
      setIsRequesting(false);
      return;
    }

    enterPanel();
  }

  function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");

    if (!email || !password) {
      setErrorMessage("Ingresa tu correo y tu contraseña.");
      return;
    }

    void signIn(email, password);
  }

  return (
    <>
      <Form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <TextField name="email" isRequired>
          <Label>Correo</Label>
          <Input
            placeholder="abc@gmail.com"
            type="email"
            autoComplete="email"
            maxLength={120}
          />
        </TextField>
        <TextField name="password" isRequired>
          <Label>Contraseña</Label>
          <Input
            placeholder="Contraseña"
            type="password"
            autoComplete="current-password"
            maxLength={72}
          />
        </TextField>

        {errorMessage ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full bg-black"
          isPending={pending === "form"}
          isDisabled={pending !== null}
        >
          {pending === "form" ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </Form>

      {showDemo ? (
        <Button
          className="mt-3 w-full bg-gray-100 text-black"
          isPending={pending === "demo"}
          isDisabled={pending !== null}
          onPress={() => void signInAsDemo()}
        >
          {pending === "demo" ? "Entrando..." : "Entrar como demo"}
        </Button>
      ) : null}
    </>
  );
}
