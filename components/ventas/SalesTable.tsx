"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Chip, Spinner, toast } from "@heroui/react";
import { FiExternalLink, FiRefreshCw, FiXCircle } from "react-icons/fi";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import {
  FilterSelect,
  ListToolbar,
  SearchInput,
} from "@/components/ui/ListToolbar";
import CancelSaleDialog from "@/components/ventas/CancelSaleDialog";
import CreateSaleModal from "@/components/ventas/CreateSaleModal";
import { getCustomerName } from "@/src/lib/customer";
import { formatCurrency, formatDate } from "@/src/lib/format";
import { usePaginatedList } from "@/src/lib/hooks/usePaginatedList";
import type { Invoice, InvoiceStatus, Sale } from "@/src/lib/types/sale";

type InvoiceResponsePayload = {
  data?: Sale;
  error?: { message?: string };
};

const INITIAL_FILTERS = { q: "", status: "", invoiceStatus: "" };

const SALE_STATUS_OPTIONS = [
  { id: "COMPLETADA", label: "Completadas" },
  { id: "ANULADA", label: "Anuladas" },
];

const INVOICE_STATUS: Record<
  InvoiceStatus,
  { label: string; color: "success" | "warning" | "danger" | "default" }
> = {
  EMITIDO: { label: "Emitido", color: "success" },
  PENDIENTE: { label: "Pendiente", color: "warning" },
  ANULADO: { label: "Anulado", color: "danger" },
  ANULACION_PENDIENTE: { label: "Anulación pendiente", color: "default" },
};

const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS).map(
  ([id, { label }]) => ({ id, label }),
);

const FILE_LINK_CLASS =
  "inline-flex items-center gap-0.5 text-xs font-medium text-link hover:underline";

function customerLabel(sale: Sale): string {
  return sale.customer ? getCustomerName(sale.customer) : "Clientes varios";
}

function invoiceCode(invoice: Invoice): string {
  return `${invoice.series}-${String(invoice.number).padStart(8, "0")}`;
}

function SaleStatusChip({ sale }: { sale: Sale }) {
  const isCompleted = sale.status === "COMPLETADA";

  return (
    <Chip color={isCompleted ? "success" : "danger"} size="sm" variant="soft">
      <Chip.Label>{isCompleted ? "Completada" : "Anulada"}</Chip.Label>
    </Chip>
  );
}

function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const { label, color } = INVOICE_STATUS[status];

  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

function InvoiceSummary({ invoice }: { invoice: Invoice | null }) {
  if (!invoice) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-mono text-xs font-medium text-foreground">
        {invoiceCode(invoice)}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <InvoiceStatusChip status={invoice.status} />
        {invoice.pdfUrl ? (
          <a
            className={FILE_LINK_CLASS}
            href={invoice.pdfUrl}
            target="_blank"
            rel="noreferrer"
          >
            PDF
            <FiExternalLink aria-hidden />
          </a>
        ) : null}
        {invoice.xmlUrl ? (
          <a
            className={FILE_LINK_CLASS}
            href={invoice.xmlUrl}
            target="_blank"
            rel="noreferrer"
          >
            XML
            <FiExternalLink aria-hidden />
          </a>
        ) : null}
      </div>
      {invoice.status === "PENDIENTE" && invoice.errorMessage ? (
        <span
          className="max-w-56 truncate text-xs text-danger"
          title={invoice.errorMessage}
        >
          {invoice.errorMessage}
        </span>
      ) : null}
    </div>
  );
}

export default function SalesTable() {
  const list = usePaginatedList<Sale, typeof INITIAL_FILTERS>({
    endpoint: "/api/ventas",
    initialFilters: INITIAL_FILTERS,
    loadErrorMessage: "No se pudieron cargar las ventas.",
  });
  const { reload, setFilter } = list;

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [emittingSaleId, setEmittingSaleId] = useState<string | null>(null);
  const [refreshingSaleId, setRefreshingSaleId] = useState<string | null>(
    null,
  );

  const handleCancelSale = useCallback(async () => {
    const sale = saleToCancel;
    if (!sale) return;

    setIsCancelling(true);

    try {
      const response = await fetch(`/api/ventas/${sale.id}/anular`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as InvoiceResponsePayload | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo anular la venta.",
        );
      }

      toast.success("Venta anulada", {
        description: `La venta #${sale.number} se anuló y el stock fue devuelto.`,
      });

      setIsCancelDialogOpen(false);
      reload();
    } catch (error) {
      toast.danger("No se pudo anular la venta", {
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsCancelling(false);
    }
  }, [saleToCancel, reload]);

  const handleEmitInvoice = useCallback(
    async (sale: Sale) => {
      setEmittingSaleId(sale.id);

      try {
        const response = await fetch(`/api/ventas/${sale.id}/comprobante`, {
          method: "POST",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as InvoiceResponsePayload | null;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? "No se pudo emitir el comprobante.",
          );
        }

        const updated = payload?.data;

        if (updated?.invoice?.status === "EMITIDO") {
          toast.success("Comprobante emitido", {
            description: `Se emitió ${updated.invoice.series}-${updated.invoice.number} correctamente.`,
          });
        } else {
          toast.warning("Comprobante pendiente", {
            description:
              updated?.invoice?.errorMessage ??
              "Nubefact no confirmó la emisión. Revisa la configuración y reintenta.",
          });
        }

        reload();
      } catch (error) {
        toast.danger("No se pudo emitir el comprobante", {
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado.",
        });
      } finally {
        setEmittingSaleId(null);
      }
    },
    [reload],
  );

  const handleRefreshCancellation = useCallback(
    async (sale: Sale) => {
      setRefreshingSaleId(sale.id);

      try {
        const response = await fetch(`/api/ventas/${sale.id}/anulacion`, {
          method: "POST",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as InvoiceResponsePayload | null;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ??
              "No se pudo consultar el estado de la anulación.",
          );
        }

        const invoice = payload?.data?.invoice;

        if (invoice?.status === "ANULADO") {
          toast.success("Anulación aceptada", {
            description: `SUNAT aceptó la anulación de ${invoice.series}-${invoice.number}.`,
          });
        } else {
          toast.warning("La anulación sigue pendiente", {
            description:
              invoice?.sunatDescription ??
              "SUNAT todavía no procesa la anulación. Vuelve a consultar más tarde.",
          });
        }

        reload();
      } catch (error) {
        toast.danger("No se pudo actualizar el estado", {
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado.",
        });
      } finally {
        setRefreshingSaleId(null);
      }
    },
    [reload],
  );

  const columns = useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: "sale",
        header: "Venta",
        isRowHeader: true,
        isPrimary: true,
        cell: (sale) => (
          <>
            <span className="font-medium text-foreground">#{sale.number}</span>
            <span className="block text-xs text-muted">
              {formatDate(sale.createdAt)}
            </span>
            {/* En pantallas estrechas el resto de columnas se resume aquí. */}
            <span className="mt-1 block text-xs text-muted md:hidden">
              {customerLabel(sale)}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
              <span className="sm:hidden">
                <SaleStatusChip sale={sale} />
              </span>
              {sale.invoice ? (
                <span className="font-mono text-xs text-muted">
                  {invoiceCode(sale.invoice)}
                </span>
              ) : null}
            </span>
          </>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        hideBelow: "md",
        cell: (sale) => customerLabel(sale),
      },
      {
        id: "items",
        header: "Productos",
        hideBelow: "xl",
        cell: (sale) => (
          <div className="flex flex-col gap-0.5">
            {sale.items.map((item) => (
              <span key={item.id}>
                {item.quantity}× {item.productName}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: "total",
        header: "Total",
        align: "end",
        cell: (sale) => (
          <span className="tabular whitespace-nowrap font-medium text-foreground">
            {formatCurrency(sale.total)}
          </span>
        ),
      },
      {
        id: "invoice",
        header: "Comprobante",
        hideBelow: "lg",
        cell: (sale) => <InvoiceSummary invoice={sale.invoice} />,
      },
      {
        id: "status",
        header: "Estado",
        hideBelow: "sm",
        cell: (sale) => <SaleStatusChip sale={sale} />,
      },
      {
        id: "actions",
        header: "Acciones",
        align: "center",
        cell: (sale) => (
          <div className="flex items-center justify-center gap-1">
            {sale.status === "COMPLETADA" ? (
              <>
                {sale.invoice?.status === "PENDIENTE" ? (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`Reintentar comprobante de venta #${sale.number}`}
                    isDisabled={emittingSaleId === sale.id}
                    onPress={() => void handleEmitInvoice(sale)}
                  >
                    {emittingSaleId === sale.id ? (
                      <Spinner size="sm" color="current" />
                    ) : (
                      <FiRefreshCw aria-hidden />
                    )}
                  </Button>
                ) : null}
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={`Anular venta #${sale.number}`}
                  onPress={() => {
                    setSaleToCancel(sale);
                    setIsCancelDialogOpen(true);
                  }}
                >
                  <FiXCircle aria-hidden />
                </Button>
              </>
            ) : sale.invoice?.status === "ANULACION_PENDIENTE" ? (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`Actualizar estado de la anulación de la venta #${sale.number}`}
                isDisabled={refreshingSaleId === sale.id}
                onPress={() => void handleRefreshCancellation(sale)}
              >
                {refreshingSaleId === sale.id ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <FiRefreshCw aria-hidden />
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted">—</span>
            )}
          </div>
        ),
      },
    ],
    [
      emittingSaleId,
      refreshingSaleId,
      handleEmitInvoice,
      handleRefreshCancellation,
    ],
  );

  const total = list.pagination.total;

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        actions={
          <>
            <Button variant="outline" onPress={reload}>
              <FiRefreshCw aria-hidden />
              Actualizar
            </Button>
            <CreateSaleModal onCreated={list.reloadFromStart} />
          </>
        }
        summary={
          list.status === "success"
            ? `${total} ${total === 1 ? "venta" : "ventas"}${list.hasActiveFilters ? " con esos filtros" : ""}`
            : list.status === "loading"
              ? "Cargando ventas..."
              : ""
        }
      >
        <SearchInput
          label="Buscar ventas"
          placeholder="N.º, cliente o producto"
          onSearch={(query) => setFilter("q", query)}
        />
        <FilterSelect
          label="Estado de la venta"
          allLabel="Todas las ventas"
          value={list.filters.status}
          options={SALE_STATUS_OPTIONS}
          onChange={(value) => setFilter("status", value)}
        />
        <FilterSelect
          label="Estado del comprobante"
          allLabel="Todos los comprobantes"
          value={list.filters.invoiceStatus}
          options={INVOICE_STATUS_OPTIONS}
          onChange={(value) => setFilter("invoiceStatus", value)}
        />
      </ListToolbar>

      <DataTable
        ariaLabel="Listado de ventas"
        columns={columns}
        items={list.items}
        getRowId={(sale) => sale.id}
        status={list.status}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRetry={reload}
        errorTitle="No se pudieron cargar las ventas."
        errorMessage={list.errorMessage}
        emptyMessage={
          list.hasActiveFilters
            ? "Ninguna venta coincide con los filtros."
            : "No hay ventas registradas."
        }
      />

      <CancelSaleDialog
        sale={saleToCancel}
        isOpen={isCancelDialogOpen}
        isCancelling={isCancelling}
        onCancel={() => setIsCancelDialogOpen(false)}
        onConfirm={handleCancelSale}
      />
    </section>
  );
}
