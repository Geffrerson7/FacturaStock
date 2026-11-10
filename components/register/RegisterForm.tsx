"use client";

import { useState, type ComponentProps } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import { z } from "zod";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Cambiar la key vuelve a montar el formulario y lo deja vacío.
  const [formKey, setFormKey] = useState(0);

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

    // Solo interfaz: todavía no existe un endpoint de registro.
    toast.success("Datos válidos", {
      description:
        "La interfaz está lista. El registro todavía no está conectado a un backend.",
    });

    setFormKey((key) => key + 1);
    setIsSubmitting(false);
  }

  return (
    <Form
      key={formKey}
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
