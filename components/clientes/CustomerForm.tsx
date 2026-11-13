"use client";

import { useState, type ComponentProps } from "react";
import { FiSearch } from "react-icons/fi";
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

type LookupResponseBody = ApiErrorBody & {
  data?: {
    documentType: CustomerDocumentType;
    documentNumber: string;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    address?: string | null;
    status?: string | null;
  };
};

const DOCUMENT_LENGTH: Record<CustomerDocumentType, number> = {
  DNI: 8,
  RUC: 11,
};

export default function CustomerForm({
  customer,
  onSuccess,
}: CustomerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Cambiar la key vuelve a montar el formulario y lo deja vacío.
  const [formKey, setFormKey] = useState(0);
  const [documentType, setDocumentType] = useState<CustomerDocumentType>(
    customer?.documentType ?? "DNI",
  );
  const [dni, setDni] = useState(customer?.dni ?? "");
  const [ruc, setRuc] = useState(customer?.ruc ?? "");
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [businessName, setBusinessName] = useState(
    customer?.businessName ?? "",
  );
  const [address, setAddress] = useState(customer?.address ?? "");

  const documentNumber = documentType === "DNI" ? dni : ruc;

  function resetFields() {
    setDni("");
    setRuc("");
    setFirstName("");
    setLastName("");
    setBusinessName("");
    setAddress("");
    setDocumentType("DNI");
  }

  async function handleLookup() {
    const numero = documentNumber.trim();
    const expectedLength = DOCUMENT_LENGTH[documentType];

    if (!new RegExp(`^\\d{${expectedLength}}$`).test(numero)) {
      toast.danger("Documento inválido", {
        description: `El ${documentType} debe tener exactamente ${expectedLength} dígitos.`,
      });
      return;
    }

    setIsLookingUp(true);

    try {
      const response = await fetch(
        `/api/consulta/${documentType.toLowerCase()}?numero=${numero}`,
        { cache: "no-store" },
      );

      const body = (await response.json().catch(() => ({}))) as LookupResponseBody;

      if (!response.ok || !body.data) {
        toast.danger("No se pudo consultar el documento", {
          description:
            body.error?.message ?? "Ocurrió un error inesperado. Inténtalo de nuevo.",
        });
        return;
      }

      if (body.data.documentType === "DNI") {
        setFirstName(body.data.firstName ?? "");
        setLastName(body.data.lastName ?? "");
      } else {
        setBusinessName(body.data.businessName ?? "");

        // La dirección solo se rellena si el usuario aún no escribió una.
        if (!address.trim() && body.data.address) {
          setAddress(body.data.address);
        }
      }

      toast.success("Datos encontrados", {
        description:
          body.data.documentType === "DNI"
            ? "Se completaron el nombre y los apellidos."
            : "Se completó la razón social.",
      });
    } catch {
      toast.danger("No se pudo consultar el documento", {
        description: "No hay conexión con el servidor. Inténtalo de nuevo.",
      });
    } finally {
      setIsLookingUp(false);
    }
  }

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
          resetFields();
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
          <div className="flex items-end gap-3">
            <TextField
              name="dni"
              value={dni}
              onChange={setDni}
              isRequired
              className="flex-1"
            >
              <Label>DNI</Label>
              <Input
                placeholder="12345678"
                maxLength={8}
                inputMode="numeric"
              />
              <FieldError />
            </TextField>

            <Button
              type="button"
              variant="secondary"
              onPress={handleLookup}
              isPending={isLookingUp}
            >
              <FiSearch />
              {isLookingUp ? "Consultando..." : "Consultar DNI"}
            </Button>
          </div>

          <div className="flex gap-4">
            <TextField
              name="firstName"
              value={firstName}
              onChange={setFirstName}
              isRequired
              className="flex-1"
            >
              <Label>Nombre</Label>
              <Input placeholder="Juan" maxLength={80} />
              <FieldError />
            </TextField>
            <TextField
              name="lastName"
              value={lastName}
              onChange={setLastName}
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
          <div className="flex items-end gap-3">
            <TextField
              name="ruc"
              value={ruc}
              onChange={setRuc}
              isRequired
              className="flex-1"
            >
              <Label>RUC</Label>
              <Input
                placeholder="20123456789"
                maxLength={11}
                inputMode="numeric"
              />
              <FieldError />
            </TextField>

            <Button
              type="button"
              variant="secondary"
              onPress={handleLookup}
              isPending={isLookingUp}
            >
              <FiSearch />
              {isLookingUp ? "Consultando..." : "Consultar RUC"}
            </Button>
          </div>

          <TextField
            name="businessName"
            value={businessName}
            onChange={setBusinessName}
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
        value={address}
        onChange={setAddress}
        isRequired
      >
        <Label>Dirección</Label>
        <Input placeholder="Av. Siempre Viva 742" maxLength={200} />
        <FieldError />
      </TextField>

      <div className="flex gap-4">
        <TextField name="phone" defaultValue={customer?.phone ?? ""} className="flex-1">
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
