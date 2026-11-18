"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Input,
  Label,
  NumberField,
  Tabs,
  TextField,
  toast,
} from "@heroui/react";
import { FiDownload, FiEdit2, FiX } from "react-icons/fi";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { FilterSelect } from "@/components/ui/ListToolbar";
import SearchPicker from "@/components/ventas/SearchPicker";
import {
  KARDEX_VIEW_MODES,
  MOVEMENT_TYPE_INFO,
  STOCK_MOVEMENT_TYPES,
  SUNAT_DOCUMENT_LABELS,
  type KardexViewMode,
} from "@/src/lib/kardex/catalog";
import {
  formatCost,
  formatCurrency,
  formatDate,
  formatQuantity,
} from "@/src/lib/format";
import type { ListStatus } from "@/src/lib/hooks/usePaginatedList";
import { limaDateKey, startOfLimaMonth } from "@/src/lib/lima-time";
import type {
  KardexBalanceDto,
  KardexReport,
  KardexResponse,
  StockMovement,
} from "@/src/lib/types/kardex";
import type { PaginationMeta } from "@/src/lib/types/pagination";
import type { Product } from "@/src/lib/types/product";

const PAGE_SIZE = 20;
const PRODUCT_SEARCH = "/api/productos?sort=name&order=asc";
const CARD = "rounded-xl border border-border bg-surface p-4 shadow-surface";

const TYPE_OPTIONS = STOCK_MOVEMENT_TYPES.map((type) => ({
  id: type,
  label: MOVEMENT_TYPE_INFO[type].label,
}));

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function defaultRange() {
  const now = new Date();
  return { from: limaDateKey(startOfLimaMonth(now)), to: limaDateKey(now) };
}

function documentLabel(movement: StockMovement): string {
  if (movement.documentSeries && movement.documentNumber !== null) {
    return `${movement.documentSeries}-${String(movement.documentNumber).padStart(8, "0")}`;
  }
  return SUNAT_DOCUMENT_LABELS[movement.documentType] ?? "—";
}

/** Unidades con signo para las columnas de entrada y salida. */
function Units({ value, tone }: { value: number; tone: "in" | "out" }) {
  return (
    <span
      className={`tabular whitespace-nowrap ${tone === "in" ? "text-success" : "text-danger"}`}
    >
      {tone === "in" ? "+" : "−"}
      {formatQuantity(value)}
    </span>
  );
}

function Stacked({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <span className="tabular inline-flex flex-col items-end whitespace-nowrap">
      <span>{primary}</span>
      {secondary ? <span className="text-xs text-muted">{secondary}</span> : null}
    </span>
  );
}

function OperationCell({ movement }: { movement: StockMovement }) {
  return (
    <div className="min-w-0">
      <span className="block font-medium text-foreground">
        {MOVEMENT_TYPE_INFO[movement.type].label}
      </span>
      <span className="block text-xs text-muted">
        {formatDate(movement.occurredAt)} · SUNAT {movement.sunatOperationCode}
      </span>
      {movement.reason ? (
        <span className="block text-xs text-muted">{movement.reason}</span>
      ) : null}
    </div>
  );
}

function physicalColumns(): DataTableColumn<StockMovement>[] {
  return [
    {
      id: "operation",
      header: "Movimiento",
      isRowHeader: true,
      isPrimary: true,
      cell: (movement) => <OperationCell movement={movement} />,
    },
    {
      id: "document",
      header: "Documento",
      hideBelow: "md",
      cell: (movement) => (
        <span className="tabular whitespace-nowrap">{documentLabel(movement)}</span>
      ),
    },
    {
      id: "user",
      header: "Usuario",
      hideBelow: "lg",
      cell: (movement) => movement.user?.name ?? "Sistema",
    },
    {
      id: "in",
      header: "Entrada",
      align: "end",
      hideBelow: "sm",
      cell: (movement) =>
        movement.direction === "ENTRADA" ? (
          <Units value={movement.quantity} tone="in" />
        ) : null,
    },
    {
      id: "out",
      header: "Salida",
      align: "end",
      hideBelow: "sm",
      cell: (movement) =>
        movement.direction === "SALIDA" ? (
          <Units value={movement.quantity} tone="out" />
        ) : null,
    },
    {
      id: "balance",
      header: "Saldo",
      align: "end",
      cell: (movement) => (
        <Stacked
          primary={formatQuantity(movement.balanceQuantity)}
          // En móvil la entrada o salida se resume bajo el saldo.
          secondary={
            <span className="sm:hidden">
              {movement.direction === "ENTRADA"
                ? `+${formatQuantity(movement.quantity)}`
                : movement.direction === "SALIDA"
                  ? `−${formatQuantity(movement.quantity)}`
                  : "Revalorización"}
            </span>
          }
        />
      ),
    },
  ];
}

function movementAmount(movement: StockMovement, direction: "ENTRADA" | "SALIDA") {
  const total = Number(movement.totalCost);

  if (movement.direction === direction) {
    return (
      <Stacked
        primary={formatCurrency(movement.totalCost)}
        secondary={`${formatQuantity(movement.quantity)} × ${formatCost(movement.unitCost)}`}
      />
    );
  }

  // Un ajuste de valorización suma o resta valor sin mover unidades.
  if (
    movement.direction === "NINGUNA" &&
    (direction === "ENTRADA" ? total >= 0 : total < 0)
  ) {
    return (
      <Stacked
        primary={formatCurrency(Math.abs(total))}
        secondary="Sin unidades"
      />
    );
  }

  return null;
}

function valuedColumns(): DataTableColumn<StockMovement>[] {
  return [
    {
      id: "operation",
      header: "Movimiento",
      isRowHeader: true,
      isPrimary: true,
      cell: (movement) => <OperationCell movement={movement} />,
    },
    {
      id: "document",
      header: "Documento",
      hideBelow: "xl",
      cell: (movement) => (
        <span className="tabular whitespace-nowrap">{documentLabel(movement)}</span>
      ),
    },
    {
      id: "in",
      header: "Entradas",
      align: "end",
      hideBelow: "md",
      cell: (movement) => movementAmount(movement, "ENTRADA"),
    },
    {
      id: "out",
      header: "Salidas",
      align: "end",
      hideBelow: "md",
      cell: (movement) => movementAmount(movement, "SALIDA"),
    },
    {
      id: "average",
      header: "Costo promedio",
      align: "end",
      hideBelow: "lg",
      cell: (movement) => (
        <span className="tabular whitespace-nowrap">
          {formatCost(movement.balanceAverageCost)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Saldo",
      align: "end",
      cell: (movement) => (
        <Stacked
          primary={formatCurrency(movement.balanceValue)}
          secondary={`${formatQuantity(movement.balanceQuantity)} u.`}
        />
      ),
    },
  ];
}

function BalanceCard({
  label,
  balance,
  mode,
}: {
  label: string;
  balance: KardexBalanceDto;
  mode: KardexViewMode;
}) {
  return (
    <li className={CARD}>
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-foreground">
        {formatQuantity(balance.quantity)} u.
      </p>
      {mode === "valorizado" ? (
        <p className="tabular text-xs text-muted">
          {formatCurrency(balance.value)} · prom. {formatCost(balance.averageCost)}
        </p>
      ) : null}
    </li>
  );
}

function MovementTotalCard({
  label,
  quantity,
  value,
  mode,
}: {
  label: string;
  quantity: number;
  value: string;
  mode: KardexViewMode;
}) {
  return (
    <li className={CARD}>
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-foreground">
        {formatQuantity(quantity)} u.
      </p>
      {mode === "valorizado" ? (
        <p className="tabular text-xs text-muted">{formatCurrency(value)}</p>
      ) : null}
    </li>
  );
}

function InitialCostEditor({
  report,
  onSaved,
}: {
  report: KardexReport;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [cost, setCost] = useState(Number(report.product.lastCost));
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    if (!Number.isFinite(cost) || cost < 0) {
      toast.danger("Costo no válido", {
        description: "Escribe un costo de 0 o más.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/productos/${report.product.id}/costo-inicial`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitCost: cost }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "No se pudo corregir el costo.");
      }

      toast.success("Costo del saldo inicial corregido", {
        description: "El kárdex se recalculó con el nuevo costo.",
      });
      setIsEditing(false);
      onSaved();
    } catch (error) {
      toast.danger("No se pudo corregir el costo", {
        description:
          error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <Button size="sm" variant="outline" onPress={() => setIsEditing(true)}>
        <FiEdit2 aria-hidden />
        Corregir costo del saldo inicial
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <NumberField
        value={cost}
        onChange={setCost}
        minValue={0}
        step={0.01}
        formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 6 }}
        className="sm:w-48"
      >
        <Label>Costo unitario (sin IGV)</Label>
        <NumberField.Group>
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>
      <div className="flex gap-2">
        <Button size="sm" isPending={isSaving} onPress={() => void save()}>
          Guardar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={isSaving}
          onPress={() => setIsEditing(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Kárdex de un producto: filtros de fecha y tipo, vista física (unidades) o
 * valorizada (unidades y soles) y descarga en Excel con los mismos filtros.
 */
export default function KardexView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") ?? "";

  const [from, setFrom] = useState(() => defaultRange().from);
  const [to, setTo] = useState(() => defaultRange().to);
  const [type, setType] = useState("");
  const [mode, setMode] = useState<KardexViewMode>("fisico");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [status, setStatus] = useState<ListStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<KardexReport | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);

  const isRangeValid = Boolean(from && to && from <= to);

  const query = useMemo(() => {
    const params = new URLSearchParams({ productId, from, to });
    if (type) params.set("type", type);
    return params;
  }, [productId, from, to, type]);

  useEffect(() => {
    if (!productId || !isRangeValid) return;

    const controller = new AbortController();
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    async function load() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/kardex?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (KardexResponse & { error?: { message?: string } })
          | null;

        if (!response.ok || !payload?.data) {
          throw new Error(
            payload?.error?.message ?? "No se pudo cargar el kárdex.",
          );
        }

        setReport(payload.data);
        setPagination(payload.pagination);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar el kárdex.",
        );
      }
    }

    void load();
    return () => controller.abort();
  }, [productId, query, page, isRangeValid, reloadKey]);

  const selectProduct = useCallback(
    (id: string) => {
      setPage(1);
      setReport(null);
      router.replace(id ? `${pathname}?productId=${id}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const columns = useMemo(
    () => (mode === "valorizado" ? valuedColumns() : physicalColumns()),
    [mode],
  );

  const [isExporting, setIsExporting] = useState(false);

  /**
   * Descarga el Excel con el modo y los filtros de la pantalla. Se pide con
   * fetch (y no con un enlace) para mostrar el error si el servidor falla.
   */
  async function handleExport() {
    const params = new URLSearchParams(query);
    params.set("mode", mode);
    setIsExporting(true);

    try {
      const response = await fetch(`/api/kardex/export?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "No se pudo generar el Excel.");
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? "kardex.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.danger("No se pudo exportar el kárdex", {
        description:
          error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  if (!productId) {
    return (
      <section className={`${CARD} flex max-w-xl flex-col gap-3 sm:p-5`}>
        <SearchPicker<Product>
          label="Producto"
          placeholder="Busca por nombre o SKU"
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
          onSelect={(item) => selectProduct(item.id)}
        />
        <p className="text-xs text-muted">
          Elige un producto para ver sus entradas, salidas y saldo.
        </p>
      </section>
    );
  }

  const product = report?.product;

  return (
    <div className="flex flex-col gap-6">
      <section className={`${CARD} flex flex-col gap-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {product?.name ?? "Cargando producto..."}
            </h2>
            {product ? (
              <p className="text-sm text-muted">
                {product.sku}
                {product.isActive ? "" : " · Inactivo"}
              </p>
            ) : null}
          </div>
          <Button size="sm" variant="outline" onPress={() => selectProduct("")}>
            <FiX aria-hidden />
            Cambiar producto
          </Button>
        </div>

        {product ? (
          <dl className="tabular grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Stock actual</dt>
              <dd className="text-base font-semibold">
                {formatQuantity(product.stock)} u.
              </dd>
            </div>
            <div>
              <dt className="text-muted">Costo promedio</dt>
              <dd className="text-base font-semibold">
                {formatCost(product.averageCost)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Valor del inventario</dt>
              <dd className="text-base font-semibold">
                {formatCurrency(product.inventoryValue)}
              </dd>
            </div>
          </dl>
        ) : null}

        {report?.canEditInitialCost ? (
          <div className="flex flex-col gap-2 border-t border-separator pt-4">
            <p className="text-xs text-muted">
              El saldo inicial es el único movimiento de este producto, así que
              puedes corregir su costo directamente.
            </p>
            <InitialCostEditor
              key={report.product.id}
              report={report}
              onSaved={() => setReloadKey((key) => key + 1)}
            />
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <TextField
            value={from}
            onChange={(value) => {
              setFrom(value);
              setPage(1);
            }}
            className="sm:w-44"
          >
            <Label>Desde</Label>
            <Input type="date" max={to || undefined} />
          </TextField>
          <TextField
            value={to}
            onChange={(value) => {
              setTo(value);
              setPage(1);
            }}
            className="sm:w-44"
          >
            <Label>Hasta</Label>
            <Input type="date" min={from || undefined} />
          </TextField>
          <FilterSelect
            label="Tipo de movimiento"
            allLabel="Todos los movimientos"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(value) => {
              setType(value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            selectedKey={mode}
            onSelectionChange={(key) => {
              if (KARDEX_VIEW_MODES.includes(key as KardexViewMode)) {
                setMode(key as KardexViewMode);
              }
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Vista del kárdex">
                <Tabs.Tab id="fisico">
                  Físico
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="valorizado">
                  Valorizado
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <Button
            variant="outline"
            isDisabled={!isRangeValid || !report}
            isPending={isExporting}
            onPress={() => void handleExport()}
          >
            <FiDownload aria-hidden />
            {isExporting ? "Generando..." : "Excel"}
          </Button>
        </div>
      </div>

      {!isRangeValid ? (
        <p role="alert" className="text-sm text-danger">
          La fecha inicial no puede ser posterior a la final.
        </p>
      ) : null}

      {report ? (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <BalanceCard label="Saldo anterior" balance={report.opening} mode={mode} />
          <MovementTotalCard
            label="Entradas del periodo"
            quantity={report.totals.entries.quantity}
            value={report.totals.entries.value}
            mode={mode}
          />
          <MovementTotalCard
            label="Salidas del periodo"
            quantity={report.totals.exits.quantity}
            value={report.totals.exits.value}
            mode={mode}
          />
          <BalanceCard label="Saldo final" balance={report.closing} mode={mode} />
        </ul>
      ) : null}

      <DataTable
        ariaLabel={
          mode === "valorizado" ? "Kárdex valorizado" : "Kárdex en unidades"
        }
        columns={columns}
        items={report?.movements ?? []}
        getRowId={(movement) => movement.id}
        status={status}
        pagination={pagination}
        onPageChange={setPage}
        onRetry={() => setReloadKey((key) => key + 1)}
        errorTitle="No se pudo cargar el kárdex."
        errorMessage={errorMessage}
        emptyMessage={
          type
            ? "No hay movimientos de ese tipo en el periodo."
            : "No hay movimientos en el periodo."
        }
      />
    </div>
  );
}
