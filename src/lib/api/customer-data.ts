import type { Prisma } from "@/src/generated/prisma/client";
import type { CreateCustomerInput } from "@/src/lib/validations/customer";

/**
 * Un cliente es persona (DNI) o empresa (RUC). Los campos del otro tipo se
 * limpian explícitamente para que el PUT no deje datos mezclados.
 */
export function normalizeCustomerData(
  data: CreateCustomerInput,
): Prisma.CustomerUncheckedCreateInput {
  if (data.documentType === "RUC") {
    return {
      documentType: data.documentType,
      ruc: data.ruc,
      businessName: data.businessName,
      dni: null,
      firstName: null,
      lastName: null,
      address: data.address,
      phone: data.phone,
      email: data.email,
    };
  }

  return {
    documentType: data.documentType,
    dni: data.dni,
    firstName: data.firstName,
    lastName: data.lastName,
    ruc: null,
    businessName: null,
    address: data.address,
    phone: data.phone,
    email: data.email,
  };
}
