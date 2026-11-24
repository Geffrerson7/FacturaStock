"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Form, Label, NumberField, toast } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { FiShoppingCart, FiTrash2, FiX } from "react-icons/fi";

import StockLevelChip from "@/components/productos/StockLevelChip";
import SearchPicker from "@/components/ventas/SearchPicker";
import { getCustomerDocumentLabel, getCustomerName } from "@/src/lib/customer";
import { formatCents, formatCurrency, formatInvoiceCode } from "@/src/lib/format";
import { computeLineTax, computeSaleTax, toCents } from "@/src/lib/tax";
import type { Customer } from "@/src/lib/types/customer";
import type { Product } from "@/src/lib/types/product";
import type { Sale } from "@/src/lib/types/sale";

type SaleLine = {
  product: Product;
  quantity: number;
  /** Precio unitario con IGV que se cobra. Empieza en el de lista. */
  unitPrice: number;
};

type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type ApiResponseBody = {
  data?: Sale;
  error?: { message?: string };
};

// Los productos y los clientes se buscan en el servidor mientras se escribe,
// así que el formulario funciona igual con 10 registros que con 10,000.
const PRODUCT_SEARCH = "/api/productos?isActive=true&sort=name&order=asc";
const CUSTOMER_SEARCH = "/api/clientes?sort=name&order=asc";

function toTaxLine(line: SaleLine) {
  return { quantity: line.quantity, unitPrice: line.unitPrice };
}

/** Precio mínimo con IGV: el del producto o, sin él, el de lista. */
function minPriceOf(product: Product): number {
  return Number(product.minPrice ?? product.price);
}

function isBelowMinimum(line: SaleLine): boolean {
  return toCents(line.unitPrice) < toCents(minPriceOf(line.product));
}

/**
 * Punto de venta: cliente, productos con cantidades editables y el desglose
 * de base imponible, IGV y total antes de confirmar. Al registrar la venta
 * lleva a su página de detalle, donde está el comprobante.
 */
export default function SaleForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sin cliente, la venta sale como boleta a "clientes varios".
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function addProduct(product: Product) {
    setErrorMessage(null);
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (!existing) {
        return [
          ...current,
          { product, quantity: 1, unitPrice: Number(product.price) },
        ];
      }

      // Elegir de nuevo un producto ya agregado suma una unidad.
      return current.map((line) =>
        line.product.id === product.id
          ? {
              ...line,
              product,
              quantity: Math.min(line.quantity + 1, Math.max(1, product.stock)),
            }
          : line,
      );
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line,
      ),
    );
  }

  function updatePrice(productId: string, unitPrice: number) {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, unitPrice } : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setLines((current) =>
      current.filter((line) => line.product.id !== productId),
    );
  }

  const validLines = lines.filter((line) => line.quantity >= 1);
  const linesBelowMinimum = validLines.filter(isBelowMinimum);
  const totals = computeSaleTax(validLines.map(toTaxLine));
  const units = validLines.reduce((sum, line) => sum + line.quantity, 0);
  const documentLabel =
    customer?.documentType === "RUC" ? "Factura" : "Boleta";

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (validLines.length === 0) {
      setErrorMessage("Agrega al menos un producto con cantidad válida.");
      return;
    }

    if (linesBelowMinimum.length > 0) {
      setErrorMessage(
        `El precio de "${linesBelowMinimum[0].product.name}" está por debajo del mínimo permitido.`,
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.id ?? null,
          items: validLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as ApiResponseBody;

      if (response.ok && body.data) {
        const sale = body.data;
        const invoice = sale.invoice;

        if (invoice?.status === "EMITIDO") {
          toast.success("Venta registrada", {
            description: `La venta #${sale.number} se registró por ${formatCurrency(sale.total)}. Comprobante ${formatInvoiceCode(invoice)} emitido.`,
          });
        } else {
          toast.warning("Venta registrada con comprobante pendiente", {
            description:
              invoice?.errorMessage ??
              "La venta se guardó, pero Nubefact no confirmó la emisión. Puedes reintentarlo desde el detalle de la venta.",
          });
        }

        // El botón sigue deshabilitado mientras se abre el detalle.
        router.push(`/admin/ventas/${sale.id}`);
        return;
      }

      const message = body.error?.message ?? "No se pudo registrar la venta.";
      setErrorMessage(message);
      toast.danger("No se pudo registrar la venta", { description: message });
    } catch {
      const message = "No hay conexión con el servidor. Inténtalo de nuevo.";
      setErrorMessage(message);
      toast.danger("No se pudo registrar la venta", { description: message });
    }

    setIsSubmitting(false);
  }

  return (
    <Form
      className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={handleSubmit}
      validationBehavior="aria"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <section
          aria-labelledby="sale-customer"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5"
        >
          <h2 id="sale-customer" className="text-base font-semibold">
            Cliente
          </h2>

          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {getCustomerName(customer)}
                </p>
                <p className="text-xs text-muted">
                  {getCustomerDocumentLabel(customer)} · {documentLabel}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onPress={() => setCustomer(null)}
              >
                <FiX aria-hidden />
                Quitar
              </Button>
            </div>
          ) : (
            <>
              <SearchPicker<Customer>
                label="Buscar cliente"
                placeholder="Nombre, razón social, DNI o RUC"
                endpoint={CUSTOMER_SEARCH}
                emptyMessage="No se encontraron clientes."
                getKey={(item) => item.id}
                renderItem={(item) => (
                  <>
                    <span className="font-medium text-foreground">
                      {getCustomerName(item)}
                    </span>
                    <span className="text-muted">
                      {" "}
                      · {getCustomerDocumentLabel(item)}
                    </span>
                  </>
                )}
                onSelect={setCustomer}
              />
              <p className="text-xs text-muted">
                Sin cliente, se emite una boleta a «Clientes varios». Elige un
                cliente con RUC para emitir una factura.
              </p>
            </>
          )}
        </section>

        <section
          aria-labelledby="sale-products"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5"
        >
          <h2 id="sale-products" className="text-base font-semibold">
            Productos
          </h2>

          <SearchPicker<Product>
            label="Agregar producto"
            placeholder="Nombre o SKU"
            endpoint={PRODUCT_SEARCH}
            emptyMessage="No se encontraron productos activos."
            getKey={(item) => item.id}
            isItemDisabled={(item) => item.stock === 0}
            renderItem={(item) => (
              <>
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-muted">
                  {" "}
                  · {item.sku} · {formatCurrency(item.price)} ·{" "}
                  {item.stock === 0 ? "Sin stock" : `Stock: ${item.stock}`}
                </span>
              </>
            )}
            onSelect={addProduct}
          />

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
              Busca un producto para agregarlo a la venta.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-separator">
              {lines.map((line) => (
                <li
                  key={line.product.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_7rem_auto] sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {line.product.name}
                    </p>
                    <p className="tabular text-xs text-muted">
                      Lista {formatCurrency(line.product.price)} · Mín.{" "}
                      {formatCurrency(minPriceOf(line.product))} · Stock:{" "}
                      {line.product.stock}
                    </p>
                    <span className="mt-1 inline-block">
                      <StockLevelChip product={line.product} />
                    </span>
                  </div>

                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <NumberField
                      value={line.unitPrice}
                      onChange={(value) =>
                        updatePrice(
                          line.product.id,
                          Number.isFinite(value) ? value : 0,
                        )
                      }
                      minValue={0}
                      step={0.01}
                      formatOptions={{
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }}
                      isInvalid={isBelowMinimum(line)}
                      aria-label={`Precio unitario de ${line.product.name}`}
                      className="w-36"
                    >
                      <Label className="sr-only">Precio unitario</Label>
                      <NumberField.Group>
                        <NumberField.Input />
                      </NumberField.Group>
                    </NumberField>
                    {isBelowMinimum(line) ? (
                      <p className="mt-1 text-xs text-danger">
                        Mínimo {formatCurrency(minPriceOf(line.product))}
                      </p>
                    ) : null}
                  </div>

                  <div className="row-start-3 sm:row-start-auto">
                    <NumberField
                      value={line.quantity}
                      onChange={(value) =>
                        updateQuantity(
                          line.product.id,
                          Number.isFinite(value) ? value : 1,
                        )
                      }
                      minValue={1}
                      maxValue={Math.max(1, line.product.stock)}
                      step={1}
                      aria-label={`Cantidad de ${line.product.name}`}
                      className="w-32"
                    >
                      <Label className="sr-only">Cantidad</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>
                  </div>

                  <p className="tabular row-start-3 self-center text-end text-sm font-medium text-foreground sm:row-start-auto sm:pt-2">
                    {formatCents(computeLineTax(toTaxLine(line)).total)}
                  </p>

                  <div className="col-start-2 row-start-1 flex justify-end sm:col-start-auto sm:row-start-auto">
                    <Button
                      type="button"
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Quitar ${line.product.name}`}
                      onPress={() => removeLine(line.product.id)}
                    >
                      <FiTrash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside
        aria-labelledby="sale-summary"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5 lg:sticky lg:top-24"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="sale-summary" className="text-base font-semibold">
            Resumen
          </h2>
          <span className="text-xs text-muted">{documentLabel}</span>
        </div>

        <dl className="tabular flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Productos</dt>
            <dd>
              {units} {units === 1 ? "unidad" : "unidades"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Base imponible</dt>
            <dd>{formatCents(totals.taxable)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">IGV (18 %)</dt>
            <dd>{formatCents(totals.igv)}</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-separator pt-3">
            <dt className="font-medium">Total</dt>
            <dd className="text-2xl font-semibold text-foreground">
              {formatCents(totals.total)}
            </dd>
          </div>
        </dl>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            fullWidth
            isPending={isSubmitting}
            isDisabled={validLines.length === 0 || linesBelowMinimum.length > 0}
          >
            <FiShoppingCart aria-hidden />
            {isSubmitting ? "Registrando..." : "Confirmar venta"}
          </Button>
          <Link
            href="/admin/ventas"
            className={buttonVariants({ variant: "ghost", fullWidth: true })}
          >
            Cancelar
          </Link>
        </div>
      </aside>
    </Form>
  );
}
