"use client";

import { useEffect, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Description,
  Form,
  Label,
  ListBox,
  NumberField,
  Select,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { FiCheck, FiX } from "react-icons/fi";

import SearchPicker from "@/components/ventas/SearchPicker";
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_TYPE_INFO,
  type ManualMovementType,
} from "@/src/lib/kardex/catalog";
import {
  formatCost,
  formatCurrency,
  formatQuantity,
} from "@/src/lib/format";
import type { KardexProduct, KardexResponse } from "@/src/lib/types/kardex";
import type { Product } from "@/src/lib/types/product";
import { createMovementSchema } from "@/src/lib/validations/kardex";

type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type FieldErrors = Record<string, string>;

type ApiErrorBody = {
  error?: {
    message?: string;
    field?: string;
    details?: { path: string; message: string }[];
  };
};

const PRODUCT_SEARCH = "/api/productos?sort=name&order=asc";

const TYPE_HELP: Record<ManualMovementType, string> = {
  INGRESO:
    "Mercadería que entra al almacén. Si conoces el costo de compra, regístralo para que el costo promedio sea real.",
  AJUSTE_POSITIVO:
    "Unidades que aparecen en un conteo físico. Entran al costo promedio vigente.",
  AJUSTE_NEGATIVO:
    "Unidades que faltan en un conteo físico. Salen al costo promedio vigente.",
  MERMA:
    "Producto vencido, dañado o perdido. Sale al costo promedio vigente.",
  AJUSTE_VALORIZACION:
    "Corrige el costo promedio sin mover unidades, por ejemplo si el saldo inicial entró a costo 0.",
};

function toKardexProduct(product: Product): KardexProduct {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    lastCost: product.lastCost,
    averageCost: product.averageCost,
    inventoryValue: product.inventoryValue,
    isActive: product.isActive,
  };
}

type Preview =
  | { ok: true; quantity: number; averageCost: number; value: number }
  | { ok: false; message: string };

/**
 * Saldo que dejaría el movimiento. Es una aproximación en coma flotante para
 * la vista previa; el cálculo que se guarda lo hace el servidor con decimales.
 */
function previewBalance(
  product: KardexProduct,
  type: ManualMovementType,
  quantity: number,
  unitCost: number | null,
): Preview {
  const stock = product.stock;
  const average = Number(product.averageCost);
  const value = Number(product.inventoryValue);

  if (type === "AJUSTE_VALORIZACION") {
    if (stock === 0) {
      return { ok: false, message: "No se puede revalorizar un producto sin stock." };
    }
    if (unitCost === null) {
      return { ok: false, message: "Indica el nuevo costo unitario." };
    }
    return { ok: true, quantity: stock, averageCost: unitCost, value: stock * unitCost };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, message: "Indica una cantidad de al menos 1 unidad." };
  }

  if (type === "AJUSTE_NEGATIVO" || type === "MERMA") {
    if (quantity > stock) {
      return {
        ok: false,
        message: `No hay stock suficiente. Disponible: ${formatQuantity(stock)}.`,
      };
    }
    const remaining = stock - quantity;
    return {
      ok: true,
      quantity: remaining,
      averageCost: average,
      value: remaining === 0 ? 0 : value - quantity * average,
    };
  }

  const cost =
    type === "INGRESO" ? (unitCost ?? Number(product.lastCost)) : average;
  const total = stock + quantity;
  const newValue = value + quantity * cost;

  return { ok: true, quantity: total, averageCost: newValue / total, value: newValue };
}

export default function MovementForm({
  initialProductId,
}: {
  initialProductId?: string;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<KardexProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(
    Boolean(initialProductId),
  );
  const [type, setType] = useState<ManualMovementType>("INGRESO");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState<number>(Number.NaN);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Producto elegido desde otra pantalla (?productId=).
  useEffect(() => {
    if (!initialProductId) return;

    const controller = new AbortController();

    fetch(`/api/kardex?productId=${initialProductId}&page=1&pageSize=1`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: KardexResponse | null) => {
        if (payload?.data) selectProduct(payload.data.product);
      })
      .catch(() => {
        // Sin producto, el buscador sigue disponible.
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProduct(false);
      });

    return () => controller.abort();
  }, [initialProductId]);

  function selectProduct(next: KardexProduct) {
    setProduct(next);
    setErrors({});
    // El último costo se sugiere en los ingresos.
    const lastCost = Number(next.lastCost);
    setUnitCost(lastCost > 0 ? lastCost : Number.NaN);
  }

  const costValue = Number.isFinite(unitCost) ? unitCost : null;
  const showsQuantity = type !== "AJUSTE_VALORIZACION";
  const showsCost = type === "INGRESO" || type === "AJUSTE_VALORIZACION";
  const preview = product
    ? previewBalance(product, type, quantity, costValue)
    : null;

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (!product) {
      setErrors({ productId: "Elige un producto." });
      return;
    }

    const parsed = createMovementSchema.safeParse({
      productId: product.id,
      type,
      quantity: showsQuantity ? quantity : undefined,
      unitCost: showsCost ? costValue : null,
      reason,
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/kardex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.ok) {
        toast.success("Movimiento registrado", {
          description: `${MOVEMENT_TYPE_INFO[type].label} de "${product.name}" registrado en el kárdex.`,
        });
        router.push(`/admin/kardex?productId=${product.id}`);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      const fieldErrors: FieldErrors = {};
      if (body.error?.field) {
        fieldErrors[body.error.field] = body.error.message ?? "Valor inválido.";
      }
      for (const detail of body.error?.details ?? []) {
        if (detail.path) fieldErrors[detail.path] ??= detail.message;
      }
      setErrors(fieldErrors);
      toast.danger("No se pudo registrar el movimiento", {
        description: body.error?.message ?? "Ocurrió un error inesperado.",
      });
    } catch {
      toast.danger("No se pudo registrar el movimiento", {
        description: "No hay conexión con el servidor. Inténtalo de nuevo.",
      });
    }

    setIsSubmitting(false);
  }

  return (
    <Form
      className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={handleSubmit}
      validationBehavior="aria"
      validationErrors={errors}
    >
      <section
        aria-labelledby="movement-data"
        className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5"
      >
        <h2 id="movement-data" className="text-base font-semibold">
          Movimiento
        </h2>

        {product ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {product.name}
              </p>
              <p className="tabular text-xs text-muted">
                {product.sku} · Stock: {formatQuantity(product.stock)} · Costo
                promedio: {formatCost(product.averageCost)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={() => setProduct(null)}
            >
              <FiX aria-hidden />
              Cambiar
            </Button>
          </div>
        ) : isLoadingProduct ? (
          <p className="text-sm text-muted">Cargando producto...</p>
        ) : (
          <div className="flex flex-col gap-1">
            <SearchPicker<Product>
              label="Producto"
              placeholder="Nombre o SKU"
              endpoint={PRODUCT_SEARCH}
              emptyMessage="No se encontraron productos."
              getKey={(item) => item.id}
              renderItem={(item) => (
                <>
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted">
                    {" "}
                    · {item.sku} · Stock: {item.stock}
                  </span>
                </>
              )}
              onSelect={(item) => selectProduct(toKardexProduct(item))}
            />
            {errors.productId ? (
              <p className="text-sm text-danger">{errors.productId}</p>
            ) : null}
          </div>
        )}

        <Select
          value={type}
          onChange={(key) => {
            if (key) setType(String(key) as ManualMovementType);
          }}
          isRequired
        >
          <Label>Tipo de movimiento</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {MANUAL_MOVEMENT_TYPES.map((key) => (
                <ListBox.Item
                  key={key}
                  id={key}
                  textValue={MOVEMENT_TYPE_INFO[key].label}
                >
                  {MOVEMENT_TYPE_INFO[key].label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <Description>{TYPE_HELP[type]}</Description>
        </Select>

        <div className="flex flex-col gap-4 sm:flex-row">
          {showsQuantity ? (
            <NumberField
              value={quantity}
              onChange={(value) => setQuantity(Number.isFinite(value) ? value : 0)}
              minValue={1}
              step={1}
              isRequired
              className="flex-1"
            >
              <Label>Cantidad (unidades)</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
              {errors.quantity ? (
                <p className="text-sm text-danger">{errors.quantity}</p>
              ) : null}
            </NumberField>
          ) : null}

          {showsCost ? (
            <NumberField
              value={unitCost}
              onChange={setUnitCost}
              minValue={0}
              step={0.01}
              formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
              isRequired={type === "AJUSTE_VALORIZACION"}
              className="flex-1"
            >
              <Label>
                {type === "INGRESO"
                  ? "Costo unitario (opcional)"
                  : "Nuevo costo unitario"}
              </Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input placeholder="0.00" />
                <NumberField.IncrementButton />
              </NumberField.Group>
              <Description>
                {type === "INGRESO"
                  ? product && Number(product.lastCost) > 0
                    ? `Sin IGV. Se sugiere el último costo (${formatCost(product.lastCost)}); vacío también lo usa.`
                    : "Sin IGV. Si lo dejas vacío, entra a costo 0."
                  : "Costo promedio que tendrá el producto, sin IGV."}
              </Description>
              {errors.unitCost ? (
                <p className="text-sm text-danger">{errors.unitCost}</p>
              ) : null}
            </NumberField>
          ) : null}
        </div>

        <TextField value={reason} onChange={setReason} isRequired>
          <Label>Motivo</Label>
          <TextArea
            placeholder="Ej.: Compra con guía 001-1234, conteo del 15/11, producto vencido..."
            maxLength={255}
            rows={3}
          />
          {errors.reason ? (
            <p className="text-sm text-danger">{errors.reason}</p>
          ) : null}
        </TextField>
      </section>

      <aside
        aria-labelledby="movement-summary"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5 lg:sticky lg:top-24"
      >
        <h2 id="movement-summary" className="text-base font-semibold">
          Saldo resultante
        </h2>

        {!product ? (
          <p className="text-sm text-muted">
            Elige un producto para ver cómo queda su saldo.
          </p>
        ) : (
          <dl className="tabular flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Stock actual</dt>
              <dd>{formatQuantity(product.stock)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Valor actual</dt>
              <dd>{formatCurrency(product.inventoryValue)}</dd>
            </div>
            {preview?.ok ? (
              <>
                <div className="mt-1 flex justify-between gap-2 border-t border-separator pt-3">
                  <dt className="font-medium">Stock después</dt>
                  <dd className="font-medium">{formatQuantity(preview.quantity)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Costo promedio</dt>
                  <dd>{formatCost(preview.averageCost.toFixed(6))}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Valor después</dt>
                  <dd>{formatCurrency(preview.value)}</dd>
                </div>
              </>
            ) : preview ? (
              <p
                role="status"
                className="mt-1 rounded-lg bg-warning-soft px-3 py-2 text-warning-soft-foreground"
              >
                {preview.message}
              </p>
            ) : null}
          </dl>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            fullWidth
            isPending={isSubmitting}
            isDisabled={!product || preview?.ok === false}
          >
            <FiCheck aria-hidden />
            {isSubmitting ? "Registrando..." : "Registrar movimiento"}
          </Button>
          <Link
            href={product ? `/admin/kardex?productId=${product.id}` : "/admin/kardex"}
            className={buttonVariants({ variant: "ghost", fullWidth: true })}
          >
            Cancelar
          </Link>
        </div>
      </aside>
    </Form>
  );
}
