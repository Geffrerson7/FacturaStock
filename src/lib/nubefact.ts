import { ApiError } from "@/src/lib/api/errors";
import { getCustomerName, WALK_IN_DNI } from "@/src/lib/customer";
import type { CustomerDocumentType } from "@/src/lib/types/customer";

export const IGV_RATE = 0.18;

/**
 * Valores que se usan si el entorno no define las variables `NUBEFACT_*`.
 * Son los de la cuenta de demostración con la que se desarrolló el proyecto.
 */
const DEFAULT_SERIES = {
  FACTURA: { series: "FFF1", initialNumber: 8 },
  BOLETA: { series: "BBB1", initialNumber: 6 },
} as const;

type InvoiceSeriesConfig<TType extends 1 | 2> = {
  series: string;
  invoiceType: TType;
  initialNumber: number;
};

function seriesMisconfigured(variable: string, expected: string): ApiError {
  return new ApiError(
    500,
    "INVOICE_SERIES_MISCONFIGURED",
    `La variable de entorno ${variable} no es válida: ${expected}.`,
  );
}

function readSeries(variable: string, prefix: "F" | "B", fallback: string) {
  const value = process.env[variable]?.trim().toUpperCase() || fallback;

  // SUNAT: 4 caracteres; "F" para facturas y "B" para boletas.
  if (!new RegExp(`^${prefix}[A-Z0-9]{3}$`).test(value)) {
    throw seriesMisconfigured(
      variable,
      `debe tener 4 caracteres y empezar con "${prefix}"`,
    );
  }

  return value;
}

function readInitialNumber(variable: string, fallback: number) {
  const raw = process.env[variable]?.trim();

  if (!raw) return fallback;

  if (!/^\d{1,8}$/.test(raw) || Number(raw) < 1) {
    throw seriesMisconfigured(variable, "debe ser un entero entre 1 y 99999999");
  }

  return Number(raw);
}

/**
 * Series y correlativos iniciales de la cuenta de Nubefact, leídos del
 * entorno en cada llamada.
 *
 * El correlativo inicial solo se usa la primera vez que se emite con una
 * serie; a partir de ahí manda la fila de `invoice_counters`.
 */
export function getInvoiceSeries(): {
  FACTURA: InvoiceSeriesConfig<1>;
  BOLETA: InvoiceSeriesConfig<2>;
} {
  return {
    FACTURA: {
      series: readSeries(
        "NUBEFACT_FACTURA_SERIES",
        "F",
        DEFAULT_SERIES.FACTURA.series,
      ),
      invoiceType: 1,
      initialNumber: readInitialNumber(
        "NUBEFACT_FACTURA_INITIAL_NUMBER",
        DEFAULT_SERIES.FACTURA.initialNumber,
      ),
    },
    BOLETA: {
      series: readSeries(
        "NUBEFACT_BOLETA_SERIES",
        "B",
        DEFAULT_SERIES.BOLETA.series,
      ),
      invoiceType: 2,
      initialNumber: readInitialNumber(
        "NUBEFACT_BOLETA_INITIAL_NUMBER",
        DEFAULT_SERIES.BOLETA.initialNumber,
      ),
    },
  };
}

export type InvoiceIdentity = {
  documentType: "FACTURA" | "BOLETA";
  invoiceType: 1 | 2;
  series: string;
  initialNumber: number;
  customerDocumentType: string;
  customerDocumentNumber: string;
  customerName: string;
  customerAddress: string;
  customerEmail: string | null;
};

export type InvoiceCustomer = {
  documentType: CustomerDocumentType;
  dni: string | null;
  ruc: string | null;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  address: string;
  email: string | null;
};

export type TaxableSaleItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type NubefactItem = {
  unidad_de_medida: "NIU";
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  precio_unitario: number;
  subtotal: number;
  tipo_de_igv: 1;
  igv: number;
  total: number;
  anticipo_regularizacion: false;
};

export type NubefactInvoicePayload = {
  operacion: "generar_comprobante";
  tipo_de_comprobante: 1 | 2;
  serie: string;
  numero: number;
  sunat_transaction: 1;
  cliente_tipo_de_documento: string;
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email?: string;
  fecha_de_emision: string;
  moneda: 1;
  porcentaje_de_igv: number;
  total_gravada: number;
  total_igv: number;
  total: number;
  enviar_automaticamente_a_la_sunat: true;
  enviar_automaticamente_al_cliente: boolean;
  items: NubefactItem[];
};

export type NubefactCancellationPayload = {
  operacion: "generar_anulacion";
  tipo_de_comprobante: number;
  serie: string;
  numero: number;
  motivo: string;
};

export type NubefactInvoiceResponse = {
  tipo_de_comprobante?: number;
  serie?: string;
  numero?: number;
  enlace?: string;
  enlace_del_pdf?: string | null;
  enlace_del_xml?: string | null;
  enlace_del_cdr?: string | null;
  aceptada_por_sunat?: boolean;
  sunat_description?: string | null;
  sunat_note?: string | null;
  sunat_responsecode?: string | null;
  sunat_soap_error?: string | null;
  cadena_para_codigo_qr?: string | null;
  codigo_hash?: string | null;
};

export type NubefactCancellationResponse = NubefactInvoiceResponse & {
  sunat_ticket_numero?: string | null;
};

export class NubefactError extends Error {
  readonly code?: number;
  readonly status?: number;
  readonly response?: unknown;

  constructor(
    message: string,
    options: { code?: number; status?: number; response?: unknown } = {},
  ) {
    super(message);
    this.name = "NubefactError";
    this.code = options.code;
    this.status = options.status;
    this.response = options.response;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function resolveInvoiceIdentity(
  customer: InvoiceCustomer | null,
): InvoiceIdentity {
  const INVOICE_SERIES = getInvoiceSeries();

  if (customer?.documentType === "RUC") {
    if (!customer.ruc) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "El cliente es una empresa (RUC) pero no tiene RUC registrado.",
        { field: "customerId" },
      );
    }

    return {
      ...INVOICE_SERIES.FACTURA,
      documentType: "FACTURA",
      customerDocumentType: "6",
      customerDocumentNumber: customer.ruc,
      customerName: truncate(
        customer.businessName ?? "EMPRESA SIN RAZÓN SOCIAL",
        100,
      ),
      customerAddress: truncate(customer.address || "-", 100),
      customerEmail: customer.email,
    };
  }

  if (
    customer?.documentType === "DNI" &&
    customer.dni &&
    customer.dni !== WALK_IN_DNI
  ) {
    return {
      ...INVOICE_SERIES.BOLETA,
      documentType: "BOLETA",
      customerDocumentType: "1",
      customerDocumentNumber: customer.dni,
      customerName: truncate(getCustomerName(customer), 100),
      customerAddress: truncate(customer.address || "-", 100),
      customerEmail: customer.email,
    };
  }

  // Ventas sin cliente o con el cliente walk-in (DNI 00000000).
  return {
    ...INVOICE_SERIES.BOLETA,
    documentType: "BOLETA",
    customerDocumentType: "-",
    customerDocumentNumber: "0",
    customerName: "CLIENTES VARIOS",
    customerAddress: "-",
    customerEmail: null,
  };
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

export function buildNubefactItems(items: TaxableSaleItem[]): {
  items: NubefactItem[];
  totalGravada: number;
  totalIgv: number;
  total: number;
} {
  const mapped = items.map((item) => {
    const priceCents = toCents(item.unitPrice);
    const totalCents = priceCents * item.quantity;
    const valorUnitCents = Math.round(priceCents / (1 + IGV_RATE));
    const subtotalCents = valorUnitCents * item.quantity;
    const igvCents = totalCents - subtotalCents;

    return {
      unidad_de_medida: "NIU" as const,
      descripcion: truncate(item.description, 250),
      cantidad: item.quantity,
      valor_unitario: valorUnitCents / 100,
      precio_unitario: priceCents / 100,
      subtotal: subtotalCents / 100,
      tipo_de_igv: 1 as const,
      igv: igvCents / 100,
      total: totalCents / 100,
      anticipo_regularizacion: false as const,
    };
  });

  const totalGravada =
    mapped.reduce((sum, item) => sum + toCents(item.subtotal), 0) / 100;
  const totalIgv =
    mapped.reduce((sum, item) => sum + toCents(item.igv), 0) / 100;
  const total = mapped.reduce((sum, item) => sum + toCents(item.total), 0) / 100;

  return { items: mapped, totalGravada, totalIgv, total };
}

export function formatNubefactDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(date)
    .replaceAll("/", "-");
}

export function buildNubefactInvoicePayload({
  identity,
  number,
  items,
}: {
  identity: InvoiceIdentity;
  number: number;
  items: TaxableSaleItem[];
}): NubefactInvoicePayload {
  const amounts = buildNubefactItems(items);

  return {
    operacion: "generar_comprobante",
    tipo_de_comprobante: identity.invoiceType,
    serie: identity.series,
    numero: number,
    sunat_transaction: 1,
    cliente_tipo_de_documento: identity.customerDocumentType,
    cliente_numero_de_documento: identity.customerDocumentNumber,
    cliente_denominacion: identity.customerName,
    cliente_direccion: identity.customerAddress,
    ...(identity.customerEmail
      ? { cliente_email: truncate(identity.customerEmail, 250) }
      : {}),
    fecha_de_emision: formatNubefactDate(new Date()),
    moneda: 1,
    porcentaje_de_igv: 18,
    total_gravada: amounts.totalGravada,
    total_igv: amounts.totalIgv,
    total: amounts.total,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: Boolean(identity.customerEmail),
    items: amounts.items,
  };
}

async function postToNubefact(
  payload: unknown,
): Promise<Record<string, unknown>> {
  const url = process.env.NUBEFACT_API_URL;
  const token = process.env.NUBEFACT_API_TOKEN;

  if (!url || !token) {
    throw new NubefactError(
      "Nubefact no está configurado. Define NUBEFACT_API_URL y NUBEFACT_API_TOKEN.",
    );
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    throw new NubefactError(
      `No se pudo conectar con Nubefact: ${
        error instanceof Error ? error.message : "error de red"
      }`,
    );
  }

  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  const record = isRecord(data) ? data : null;
  const errorMessage =
    (typeof record?.errors === "string" && record.errors) ||
    (typeof record?.error === "string" && record.error) ||
    null;
  const errorCode = toNumber(record?.codigo) ?? undefined;

  if (!response.ok) {
    throw new NubefactError(
      errorMessage || text || `Nubefact respondió HTTP ${response.status}.`,
      { code: errorCode, status: response.status, response: data },
    );
  }

  if (errorMessage) {
    throw new NubefactError(errorMessage, {
      code: errorCode,
      status: response.status,
      response: data,
    });
  }

  if (!record) {
    throw new NubefactError("Nubefact devolvió una respuesta inválida.");
  }

  return record;
}

export async function sendNubefactInvoice(
  payload: NubefactInvoicePayload,
): Promise<NubefactInvoiceResponse> {
  return (await postToNubefact(payload)) as NubefactInvoiceResponse;
}

export async function consultNubefactInvoice({
  invoiceType,
  series,
  number,
}: {
  invoiceType: number;
  series: string;
  number: number;
}): Promise<NubefactInvoiceResponse> {
  return (await postToNubefact({
    operacion: "consultar_comprobante",
    tipo_de_comprobante: invoiceType,
    serie: series,
    numero: number,
  })) as NubefactInvoiceResponse;
}

export async function sendNubefactCancellation(
  payload: NubefactCancellationPayload,
): Promise<NubefactCancellationResponse> {
  return (await postToNubefact(payload)) as NubefactCancellationResponse;
}

/** Consulta en qué quedó una anulación (comunicación de baja) ya enviada. */
export async function consultNubefactCancellation({
  invoiceType,
  series,
  number,
}: {
  invoiceType: number;
  series: string;
  number: number;
}): Promise<NubefactCancellationResponse> {
  return (await postToNubefact({
    operacion: "consultar_anulacion",
    tipo_de_comprobante: invoiceType,
    serie: series,
    numero: number,
  })) as NubefactCancellationResponse;
}

export function mapNubefactInvoice(response: NubefactInvoiceResponse) {
  const pdfUrl =
    toText(response.enlace_del_pdf) ??
    (toText(response.enlace) ? `${response.enlace}.pdf` : null);

  return {
    sunatAccepted:
      typeof response.aceptada_por_sunat === "boolean"
        ? response.aceptada_por_sunat
        : null,
    sunatDescription: toText(response.sunat_description),
    sunatNote: toText(response.sunat_note),
    sunatResponseCode: toText(response.sunat_responsecode),
    pdfUrl,
    xmlUrl: toText(response.enlace_del_xml),
    cdrUrl: toText(response.enlace_del_cdr),
    hash: toText(response.codigo_hash),
    qrString: toText(response.cadena_para_codigo_qr),
    response,
  };
}
