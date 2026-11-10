import type { Customer } from "./types/customer";

type CustomerIdentity = Pick<
  Customer,
  | "documentType"
  | "dni"
  | "ruc"
  | "firstName"
  | "lastName"
  | "businessName"
>;

export function getCustomerName(customer: CustomerIdentity): string {
  if (customer.documentType === "RUC") {
    return customer.businessName ?? "Empresa sin razón social";
  }

  const fullName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ");

  return fullName || "Cliente sin nombre";
}

export function getCustomerDocument(customer: CustomerIdentity): string {
  if (customer.documentType === "RUC") {
    return customer.ruc ?? "—";
  }

  return customer.dni ?? "—";
}

export function getCustomerDocumentLabel(customer: CustomerIdentity): string {
  return `${customer.documentType} ${getCustomerDocument(customer)}`;
}
