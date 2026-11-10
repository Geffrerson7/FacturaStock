import type { Customer } from "./customer";
import type { PaginationMeta } from "./pagination";

export type SaleStatus = "COMPLETADA" | "ANULADA";

export type InvoiceDocumentType = "FACTURA" | "BOLETA";

export type InvoiceStatus =
  | "PENDIENTE"
  | "EMITIDO"
  | "ANULADO"
  | "ANULACION_PENDIENTE";

export type Invoice = {
  id: string;
  saleId: string;
  documentType: InvoiceDocumentType;
  invoiceType: number;
  series: string;
  number: number;
  status: InvoiceStatus;
  sunatAccepted: boolean | null;
  sunatDescription: string | null;
  sunatNote: string | null;
  sunatResponseCode: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  cdrUrl: string | null;
  hash: string | null;
  qrString: string | null;
  errorMessage: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleItem = {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
};

export type Sale = {
  id: string;
  number: number;
  customerId: string | null;
  customer: Customer | null;
  total: string;
  status: SaleStatus;
  invoice: Invoice | null;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
};

export type SalesPageResponse = {
  data: Sale[];
  pagination: PaginationMeta;
};
