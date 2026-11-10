"use client";

import { useState, type ComponentProps } from "react";
import {
  Button,
  Form,
  Label,
  ListBox,
  NumberField,
  Select,
  toast,
} from "@heroui/react";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import { formatCurrency } from "@/src/lib/format";
import { getCustomerDocument, getCustomerName } from "@/src/lib/customer";
import type { Customer } from "@/src/lib/types/customer";
import type { Product } from "@/src/lib/types/product";
import type { Sale } from "@/src/lib/types/sale";

type SaleFormProps = {
  products: Product[];
  customers: Customer[];
  onSuccess?: (sale: Sale) => void;
};

type SaleLine = {
  key: number;
  productId: string;
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

const WALK_IN = "walk-in";

function createLine(key: number): SaleLine {
  return { key, productId: "", quantity: 1 };
}

export default function SaleForm({
  products,
  customers,
  onSuccess,
}: SaleFormProps) {
  const availableProducts = products.filter((product) => product.isActive);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState(WALK_IN);
  const [lines, setLines] = useState<SaleLine[]>([createLine(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateLine(key: number, patch: Partial<SaleLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, createLine(nextKey)]);
    setNextKey((key) => key + 1);
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length === 1
        ? current
        : current.filter((line) => line.key !== key),
    );
  }

  const productById = new Map(
    availableProducts.map((product) => [product.id, product]),
  );

  const total = lines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    if (!product) return sum;

    return sum + Number(product.price) * line.quantity;
  }, 0);

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const items = lines
      .filter((line) => line.productId && line.quantity >= 1)
      .map((line) => ({
        productId: line.productId,
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
        body: JSON.stringify({
          customerId: customerId === WALK_IN ? null : customerId,
          items,
        }),
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

        setCustomerId(WALK_IN);
        setLines([createLine(nextKey)]);
        setNextKey((key) => key + 1);
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

  if (availableProducts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No hay productos activos disponibles para vender. Activa o registra un
        producto primero.
      </p>
    );
  }

  return (
    <Form
      className="flex w-full flex-col gap-5"
      onSubmit={handleSubmit}
      validationBehavior="aria"
    >
      <Select
        value={customerId}
        onChange={(key) => setCustomerId(String(key))}
      >
        <Label>Cliente</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id={WALK_IN} textValue="Cliente walk-in">
              Cliente walk-in (sin registro)
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {customers.map((customer) => (
              <ListBox.Item
                key={customer.id}
                id={customer.id}
                textValue={`${getCustomerName(customer)} · ${getCustomerDocument(customer)}`}
              >
                {getCustomerName(customer)} · {getCustomerDocument(customer)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Productos</p>
          <Button type="button" size="sm" variant="outline" onPress={addLine}>
            <FiPlus aria-hidden />
            Agregar línea
          </Button>
        </div>

        {lines.map((line) => {
          const selected = productById.get(line.productId);
          const maxStock = selected?.stock ?? 1;

          return (
            <div
              key={line.key}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <div className="flex flex-col gap-1">
                <Select
                  value={line.productId || null}
                  onChange={(key) =>
                    updateLine(line.key, {
                      productId: String(key),
                      quantity: 1,
                    })
                  }
                  placeholder="Selecciona un producto"
                >
                  <Label className="text-xs">Producto</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {availableProducts.map((product) => (
                        <ListBox.Item
                          key={product.id}
                          id={product.id}
                          textValue={`${product.name} (${product.sku})`}
                          isDisabled={product.stock === 0}
                        >
                          {product.name} · {formatCurrency(product.price)} · Stock:{" "}
                          {product.stock}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {selected ? (
                  <p className="text-xs text-slate-500">
                    Precio unitario: {formatCurrency(selected.price)} · Stock
                    disponible: {selected.stock}
                  </p>
                ) : null}
              </div>

              <NumberField
                value={line.quantity}
                onChange={(value) =>
                  updateLine(line.key, {
                    quantity: Number.isFinite(value) ? value : 1,
                  })
                }
                minValue={1}
                maxValue={Math.max(1, maxStock)}
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
                  aria-label="Quitar línea"
                  isDisabled={lines.length === 1}
                  onPress={() => removeLine(line.key)}
                >
                  <FiTrash2 aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
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
