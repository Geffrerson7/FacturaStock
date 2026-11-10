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

import type { Category } from "@/src/lib/types/category";
import { createCategorySchema } from "@/src/lib/validations/category";

type FieldErrors = Record<string, string>;

type CategoryFormProps = {
  category?: Category;
  onSuccess?: (category: Category) => void;
};

// Tipo del evento que entrega el Form de HeroUI en onSubmit.
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    field?: string;
    details?: { path: string; message: string }[];
  };
};

type ApiResponseBody = ApiErrorBody & { data?: Category };

export default function CategoryForm({
  category,
  onSuccess,
}: CategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Cambiar la key vuelve a montar el formulario y lo deja vacío.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(event.currentTarget));

    // Validación en el cliente con el mismo esquema que usa la API.
    const parsed = createCategorySchema.safeParse(values);

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

    const endpoint = category
      ? `/api/categorias/${category.id}`
      : "/api/categorias";
    const method = category ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => ({}))) as ApiResponseBody;

      if (response.ok) {
        if (category) {
          toast.success("Categoría actualizada", {
            description: "Los datos de la categoría se actualizaron.",
          });
        } else {
          toast.success("Categoría creada", {
            description: "La categoría se guardó correctamente.",
          });
          setFormKey((key) => key + 1);
        }

        if (body.data) onSuccess?.(body.data);
        return;
      }

      const apiError = body.error;

      // Marca en el formulario los campos que la API rechazó.
      const fieldErrors: FieldErrors = {};
      if (apiError?.field) {
        fieldErrors[apiError.field] = apiError.message ?? "Valor inválido.";
      }
      for (const detail of apiError?.details ?? []) {
        if (detail.path) fieldErrors[detail.path] ??= detail.message;
      }
      setErrors(fieldErrors);

      toast.danger(
        category
          ? "No se pudo actualizar la categoría"
          : "No se pudo crear la categoría",
        {
          description: apiError?.message ?? "Ocurrió un error inesperado.",
        },
      );
    } catch {
      toast.danger(
        category
          ? "No se pudo actualizar la categoría"
          : "No se pudo crear la categoría",
        {
          description: "No hay conexión con el servidor. Inténtalo de nuevo.",
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      key={formKey}
      className="flex w-full max-w-xl flex-col gap-4"
      validationErrors={errors}
      validationBehavior="aria"
      onSubmit={handleSubmit}
    >
      <TextField
        name="name"
        defaultValue={category?.name ?? ""}
        isRequired
      >
        <Label>Nombre</Label>
        <Input placeholder="Bebidas" maxLength={80} />
        <FieldError />
      </TextField>

      <TextField
        name="description"
        defaultValue={category?.description ?? ""}
      >
        <Label>Descripción (opcional)</Label>
        <Input placeholder="Bebidas y refrescos" maxLength={200} />
        <FieldError />
      </TextField>

      <Button
        type="submit"
        className="w-full bg-black"
        isPending={isSubmitting}
      >
        {isSubmitting
          ? category
            ? "Guardando..."
            : "Creando..."
          : category
            ? "Guardar cambios"
            : "Crear categoría"}
      </Button>
    </Form>
  );
}
