"use client";

import { useState, type ComponentProps } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  toast,
} from "@heroui/react";

import { createCustomerSchema } from "@/src/lib/validations/customer";
import type { Customer, CustomerDocumentType } from "@/src/lib/types/customer";

type FieldErrors = Record<string, string>;

type CustomerFormProps = {
  customer?: Customer;
  onSuccess?: (customer: Customer) => void;
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

type ApiResponseBody = ApiErrorBody & { data?: Customer };

export default function CustomerForm({
  customer,
  onSuccess,
}: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Cambiar la key vuelve a montar el formulario y lo deja vacío.
  const [formKey, setFormKey] = useState(0);
  const [documentType, setDocumentType] = useState<CustomerDocumentType>(
    customer?.documentType ?? "DNI",
  );

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const values = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      documentType,
    };

    // Validación en el cliente con el mismo esquema que usa la API.
    const parsed = createCustomerSchema.safeParse(values);

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

    const endpoint = customer ? `/api/clientes/${customer.id}` : "/api/clientes";
    const method = customer ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => ({}))) as ApiResponseBody;

      if (response.ok) {
        if (customer) {
          toast.success("Cliente actualizado", {
            description:
              "Los datos del cliente se actualizaron correctamente.",
          });
        } else {
          toast.success("Cliente registrado", {
            description: "El cliente se guardó correctamente.",
          });
          setFormKey((key) => key + 1);
          setDocumentType("DNI");
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
        customer
          ? "No se pudo actualizar el cliente"
          : "No se pudo registrar el cliente",
        {
          description: apiError?.message ?? "Ocurrió un error inesperado.",
        },
      );
    } catch {
      toast.danger(
        customer
          ? "No se pudo actualizar el cliente"
          : "No se pudo registrar el cliente",
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
      className="flex flex-col gap-4 w-full max-w-xl"
      validationErrors={errors}
      validationBehavior="aria"
      onSubmit={handleSubmit}
    >
      <Select
        value={documentType}
        onChange={(key) => {
          setDocumentType(String(key) as CustomerDocumentType);
          setErrors({});
        }}
        isRequired
      >
        <Label>Tipo de documento</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="DNI" textValue="DNI — Persona natural">
              DNI — Persona natural
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="RUC" textValue="RUC — Empresa">
              RUC — Empresa
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      {documentType === "DNI" ? (
        <>
          <TextField name="dni" defaultValue={customer?.dni ?? ""} isRequired>
            <Label>DNI</Label>
            <Input
              placeholder="12345678"
              maxLength={8}
              inputMode="numeric"
            />
            <FieldError />
          </TextField>

          <div className="flex gap-4">
            <TextField
              name="firstName"
              defaultValue={customer?.firstName ?? ""}
              isRequired
              className="flex-1"
            >
              <Label>Nombre</Label>
              <Input placeholder="Juan" maxLength={80} />
              <FieldError />
            </TextField>
            <TextField
              name="lastName"
              defaultValue={customer?.lastName ?? ""}
              isRequired
              className="flex-1"
            >
              <Label>Apellido</Label>
              <Input placeholder="Pérez" maxLength={80} />
              <FieldError />
            </TextField>
          </div>
        </>
      ) : (
        <>
          <TextField name="ruc" defaultValue={customer?.ruc ?? ""} isRequired>
            <Label>RUC</Label>
            <Input
              placeholder="20123456789"
              maxLength={11}
              inputMode="numeric"
            />
            <FieldError />
          </TextField>

          <TextField
            name="businessName"
            defaultValue={customer?.businessName ?? ""}
            isRequired
          >
            <Label>Razón social</Label>
            <Input placeholder="Mi Empresa S.A.C." maxLength={160} />
            <FieldError />
          </TextField>
        </>
      )}

      <TextField
        name="address"
        defaultValue={customer?.address}
        isRequired
      >
        <Label>Dirección</Label>
        <Input placeholder="Av. Siempre Viva 742" maxLength={200} />
        <FieldError />
      </TextField>

      <div className="flex gap-4">
        <TextField
          name="phone"
          defaultValue={customer?.phone ?? ""}
          className="flex-1"
        >
          <Label>Teléfono (opcional)</Label>
          <Input placeholder="+51 999 999 999" maxLength={20} type="tel" />
          <FieldError />
        </TextField>
        <TextField
          name="email"
          defaultValue={customer?.email ?? ""}
          className="flex-1"
        >
          <Label>Correo (opcional)</Label>
          <Input placeholder="abc@gmail.com" maxLength={120} type="email" />
          <FieldError />
        </TextField>
      </div>

      <Button type="submit" className="bg-black w-full" isPending={isSubmitting}>
        {isSubmitting
          ? customer
            ? "Guardando..."
            : "Registrando..."
          : customer
            ? "Guardar cambios"
            : "Registrar cliente"}
      </Button>
    </Form>
  );
}
