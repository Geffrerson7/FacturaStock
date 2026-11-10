import type { PaginationMeta } from "./pagination";

export type { PaginationMeta } from "./pagination";

export type CustomerDocumentType = "DNI" | "RUC";

export type Customer = {
  id: string;
  documentType: CustomerDocumentType;
  dni: string | null;
  ruc: string | null;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomersPageResponse = {
  data: Customer[];
  pagination: PaginationMeta;
};
