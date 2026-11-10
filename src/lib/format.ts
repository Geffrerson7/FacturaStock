const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatCurrency(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) return "—";

  return currencyFormatter.format(amount);
}

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return dateFormatter.format(date);
}
