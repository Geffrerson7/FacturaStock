import { z } from "zod";

import { WALK_IN_DNI } from "@/src/lib/customer";

import {
  optionalEnum,
  paginationQuery,
  searchQuery,
  sortQuery,
} from "./list";

const optionalPhone = z
  .string("El teléfono debe ser un texto.")
  .trim()
  .max(20, "El teléfono no puede superar los 20 caracteres.")
  .regex(
    /^[0-9+\-() ]*$/,
    "El teléfono solo puede contener dígitos, espacios y los caracteres + - ( ).",
  )
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalEmail = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string("El correo electrónico debe ser un texto.")
      .trim()
      .toLowerCase()
      .max(120, "El correo electrónico no puede superar los 120 caracteres.")
      .pipe(z.email("El correo electrónico no es válido."))
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const requiredAddress = z
  .string("La dirección es obligatoria.")
  .trim()
  .min(1, "La dirección es obligatoria.")
  .max(200, "La dirección no puede superar los 200 caracteres.");

const dniCustomerSchema = z.object({
  documentType: z.literal("DNI"),
  dni: z
    .string("El DNI es obligatorio.")
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos.")
    // El DNI 00000000 identifica al cliente de ventas sin registro.
    .refine((value) => value !== WALK_IN_DNI, "Ese DNI está reservado."),
  firstName: z
    .string("El nombre es obligatorio.")
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "El nombre no puede superar los 80 caracteres."),
  lastName: z
    .string("El apellido es obligatorio.")
    .trim()
    .min(1, "El apellido es obligatorio.")
    .max(80, "El apellido no puede superar los 80 caracteres."),
  address: requiredAddress,
  phone: optionalPhone,
  email: optionalEmail,
});

const rucCustomerSchema = z.object({
  documentType: z.literal("RUC"),
  ruc: z
    .string("El RUC es obligatorio.")
    .trim()
    .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 dígitos."),
  businessName: z
    .string("La razón social es obligatoria.")
    .trim()
    .min(1, "La razón social es obligatoria.")
    .max(160, "La razón social no puede superar los 160 caracteres."),
  address: requiredAddress,
  phone: optionalPhone,
  email: optionalEmail,
});

const customerSchema = z.discriminatedUnion(
  "documentType",
  [dniCustomerSchema, rucCustomerSchema],
  "El tipo de documento debe ser DNI o RUC.",
);

// Si el cliente no envía documentType, se asume DNI para mantener
// compatibilidad con los consumidores anteriores de la API.
export const createCustomerSchema = z.preprocess(
  (value) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !("documentType" in value)
    ) {
      return { ...value, documentType: "DNI" };
    }

    return value;
  },
  customerSchema,
);

export const customerIdSchema = z.uuid(
  "El identificador del cliente no es válido.",
);

// El PUT reemplaza todos los campos, por eso comparte las reglas de creación.
export const updateCustomerSchema = createCustomerSchema;

export const CUSTOMER_SORT_FIELDS = ["createdAt", "name", "document"] as const;

export const listCustomersQuerySchema = z.object({
  ...paginationQuery,
  q: searchQuery,
  documentType: optionalEnum(
    ["DNI", "RUC"],
    "El tipo de documento debe ser DNI o RUC.",
  ),
  ...sortQuery(CUSTOMER_SORT_FIELDS, { sort: "createdAt", order: "desc" }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
