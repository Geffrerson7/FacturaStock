import { LIMA_TIME_ZONE } from "@/src/lib/lima-time";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// La hora de Lima es fija: el servidor puede estar en UTC y el resultado
// tiene que ser el mismo en el servidor y en el navegador.
const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: LIMA_TIME_ZONE,
});

export function formatCurrency(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) return "—";

  return currencyFormatter.format(amount);
}

/** Importe guardado en céntimos. */
export function formatCents(cents: number): string {
  return formatCurrency(cents / 100);
}

export function formatDate(value: string | Date): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return dateFormatter.format(date);
}

/** Código del comprobante con el número relleno a 8 cifras: F001-00000123. */
export function formatInvoiceCode(invoice: {
  series: string;
  number: number;
}): string {
  return `${invoice.series}-${String(invoice.number).padStart(8, "0")}`;
}
