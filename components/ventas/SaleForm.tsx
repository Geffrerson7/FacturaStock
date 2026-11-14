"use client";

import { useState, type ComponentProps } from "react";
import { Button, Form, Label, NumberField, toast } from "@heroui/react";
import { FiTrash2, FiX } from "react-icons/fi";

import SearchPicker from "@/components/ventas/SearchPicker";
import { formatCurrency } from "@/src/lib/format";
import { getCustomerDocumentLabel, getCustomerName } from "@/src/lib/customer";
import type { Customer } from "@/src/lib/types/customer";
import type { Product } from "@/src/lib/types/product";
import type { Sale } from "@/src/lib/types/sale";

type SaleFormProps = {
  onSuccess?: (sale: Sale) => void;
};

type SaleLine = {
  product: Product;
  quantity: number;
};

type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    field?: string;
    details?: { path: string; message: string }[];
  };
};

type ApiResponseBody = ApiErrorBody & { data?: Sale };

// Los productos y los clientes se buscan en el servidor mientras se escribe,
// así que el formulario funciona igual con 10 registros que con 10,000.
const PRODUCT_SEARCH = "/api/productos?isActive=true&sort=name&order=asc";
const CUSTOMER_SEARCH = "/api/clientes?sort=name&order=asc";

export default function SaleForm({ onSuccess }: SaleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sin cliente, la venta sale como boleta a "clientes varios".
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function addProduct(product: Product) {
    setErrorMessage(null);
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (!existing) return [...current, { product, quantity: 1 }];

      // Elegir de nuevo un producto ya agregado suma una unidad.
      return current.map((line) =>
        line.product.id === product.id
          ? {
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

  function removeLine(productId: string) {
    setLines((current) =>
      current.filter((line) => line.product.id !== productId),
    );
  }

  const total = lines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.quantity,
    0,
  );

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const items = lines
      .filter((line) => line.quantity >= 1)
      .map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      }));

    if (items.length === 0) {
      setErrorMessage("Agrega al menos un producto con cantidad válida.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer?.id ?? null, items }),
      });

      const body = (await response.json().catch(() => ({}))) as ApiResponseBody;

      if (response.ok && body.data) {
        const invoice = body.data.invoice;

        if (invoice?.status === "EMITIDO") {
          toast.success("Venta registrada", {
            description: `La venta #${body.data.number} se registró por ${formatCurrency(body.data.total)}. Comprobante ${invoice.series}-${invoice.number} emitido.`,
          });
        } else {
          toast.warning("Venta registrada con comprobante pendiente", {
            description:
              invoice?.errorMessage ??
              "La venta se guardó, pero Nubefact no confirmó la emisión. Reintenta desde la tabla de ventas.",
          });
        }

        setCustomer(null);
        setLines([]);
        onSuccess?.(body.data);
        return;
      }

      const message =
        body.error?.message ?? "No se pudo registrar la venta.";
      setErrorMessage(message);

      toast.danger("No se pudo registrar la venta", {
        description: message,
      });
    } catch {
      const message = "No hay conexión con el servidor. Inténtalo de nuevo.";
      setErrorMessage(message);
      toast.danger("No se pudo registrar la venta", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      className="flex w-full flex-col gap-5"
      onSubmit={handleSubmit}
      validationBehavior="aria"
    >
      <div className="flex flex-col gap-2">
        {customer ? (
          <>
            <p className="text-sm font-medium text-slate-700">Cliente</p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {getCustomerName(customer)}
                </p>
                <p className="text-xs text-slate-500">
                  {getCustomerDocumentLabel(customer)} ·{" "}
                  {customer.documentType === "RUC" ? "Factura" : "Boleta"}
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
          </>
        ) : (
          <>
            <SearchPicker<Customer>
              label="Cliente"
              placeholder="Busca por nombre, razón social, DNI o RUC"
              endpoint={CUSTOMER_SEARCH}
              emptyMessage="No se encontraron clientes."
              getKey={(item) => item.id}
              renderItem={(item) => (
                <>
                  <span className="font-medium text-slate-900">
                    {getCustomerName(item)}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    · {getCustomerDocumentLabel(item)}
                  </span>
                </>
              )}
              onSelect={setCustomer}
            />
            <p className="text-xs text-slate-500">
              Sin cliente seleccionado, la venta se registra sin cliente y se
              emite una boleta a «Clientes varios».
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SearchPicker<Product>
          label="Agregar producto"
          placeholder="Busca por nombre o SKU"
          endpoint={PRODUCT_SEARCH}
          emptyMessage="No se encontraron productos activos."
          getKey={(item) => item.id}
          isItemDisabled={(item) => item.stock === 0}
          renderItem={(item) => (
            <>
              <span className="font-medium text-slate-900">{item.name}</span>
              <span className="text-slate-500">
                {" "}
                · {item.sku} · {formatCurrency(item.price)} ·{" "}
                {item.stock === 0 ? "Sin stock" : `Stock: ${item.stock}`}
              </span>
            </>
          )}
          onSelect={addProduct}
        />

        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            Todavía no agregaste productos a la venta.
          </p>
        ) : (
          lines.map((line) => (
            <div
              key={line.product.id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {line.product.name}
                </p>
                <p className="text-xs text-slate-500">
                  Precio unitario: {formatCurrency(line.product.price)} · Stock
                  disponible: {line.product.stock}
                </p>
                <p className="text-xs text-slate-700">
                  Subtotal:{" "}
                  {formatCurrency(Number(line.product.price) * line.quantity)}
                </p>
              </div>

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
                className="sm:w-32"
              >
                <Label className="text-xs">Cantidad</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>

              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  isIconOnly
                  variant="ghost"
                  aria-label={`Quitar ${line.product.name}`}
                  onPress={() => removeLine(line.product.id)}
                >
                  <FiTrash2 aria-hidden />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">Total (IGV incluido)</span>
        <span className="text-lg font-semibold text-slate-900">
          {formatCurrency(total)}
        </span>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full bg-black" isPending={isSubmitting}>
        {isSubmitting ? "Registrando..." : "Registrar venta"}
      </Button>
    </Form>
  );
}
