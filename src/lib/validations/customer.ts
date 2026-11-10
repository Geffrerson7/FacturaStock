import { z } from "zod";

const optionalPhone = z
  .string()
  .trim()
  .max(20, "Phone must be at most 20 characters.")
  .regex(
    /^[0-9+\-() ]*$/,
    "Phone can only contain digits, spaces, and + - ( ) characters.",
  )
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalEmail = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(120, "Email must be at most 120 characters.")
      .pipe(z.email("Email must be a valid email address."))
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const requiredAddress = z
  .string()
  .trim()
  .min(1, "Address is required.")
  .max(200, "Address must be at most 200 characters.");

const dniCustomerSchema = z.object({
  documentType: z.literal("DNI"),
  dni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "DNI must contain exactly 8 digits."),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80, "First name must be at most 80 characters."),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(80, "Last name must be at most 80 characters."),
  address: requiredAddress,
  phone: optionalPhone,
  email: optionalEmail,
});

const rucCustomerSchema = z.object({
  documentType: z.literal("RUC"),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "RUC must contain exactly 11 digits."),
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required.")
    .max(160, "Business name must be at most 160 characters."),
  address: requiredAddress,
  phone: optionalPhone,
  email: optionalEmail,
});

const customerSchema = z.discriminatedUnion("documentType", [
  dniCustomerSchema,
  rucCustomerSchema,
]);

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

export const customerIdSchema = z.uuid("Customer id must be a valid UUID.");

// El PUT reemplaza todos los campos, por eso comparte las reglas de creación.
export const updateCustomerSchema = createCustomerSchema;

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
