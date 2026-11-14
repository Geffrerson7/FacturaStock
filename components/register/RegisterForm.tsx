"use client";

import { useState, useTransition, type ComponentProps } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { authClient } from "@/src/lib/auth-client";

type FieldErrors = Record<string, string>;

// Tipo del evento que entrega el Form de HeroUI en onSubmit.
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Ingresa tu nombre completo.")
      .max(120, "El nombre debe tener como máximo 120 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "Ingresa tu correo.")
      .pipe(z.email("Ingresa un correo válido.")),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "La contraseña debe tener como máximo 72 caracteres."),
    confirmPassword: z.string().min(1, "Repite la contraseña."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export default function RegisterForm() {
  const router = useRouter();
  const [isRequesting, setIsSubmitting] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const isSubmitting = isRequesting || isNavigating;
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = registerSchema.safeParse(values);

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const { error } = await authClient.signUp.email({
      name: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      if (error.status === 422 || error.code?.startsWith("USER_ALREADY_EXISTS")) {
        setErrors({ email: "Ya existe una cuenta con ese correo." });
      } else {
        toast.danger("No se pudo crear la cuenta", {
          description:
            error.status === 429
              ? "Demasiados intentos. Espera unos segundos y vuelve a probar."
              : "Inténtalo de nuevo en unos segundos.",
        });
      }
      setIsSubmitting(false);
      return;
    }

    // El registro inicia la sesión automáticamente. El botón se libera al
    // terminar la navegación, porque Next conserva el estado de esta pantalla.
    startNavigation(() => {
      router.push("/admin/dashboard");
      router.refresh();
    });
    setIsSubmitting(false);
  }

  return (
    <Form
      className="mt-8 flex w-full flex-col gap-4"
      validationErrors={errors}
      validationBehavior="aria"
      onSubmit={handleSubmit}
    >
      <TextField name="fullName" isRequired>
        <Label>Nombre completo</Label>
        <Input
          placeholder="Juan Pérez"
          maxLength={120}
          autoComplete="name"
        />
        <FieldError />
      </TextField>

      <TextField name="email" isRequired>
        <Label>Correo electrónico</Label>
        <Input
          placeholder="abc@gmail.com"
          maxLength={120}
          type="email"
          autoComplete="email"
        />
        <FieldError />
      </TextField>

      <TextField name="password" isRequired>
        <Label>Contraseña</Label>
        <Input
          placeholder="Mínimo 8 caracteres"
          maxLength={72}
          type="password"
          autoComplete="new-password"
        />
        <FieldError />
      </TextField>

      <TextField name="confirmPassword" isRequired>
        <Label>Repetir contraseña</Label>
        <Input
          placeholder="Vuelve a escribir tu contraseña"
          maxLength={72}
          type="password"
          autoComplete="new-password"
        />
        <FieldError />
      </TextField>

      <Button type="submit" className="mt-2 w-full bg-black" isPending={isSubmitting}>
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </Form>
  );
}
