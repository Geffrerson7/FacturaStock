"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { FiExternalLink, FiPlus, FiRefreshCw, FiXCircle } from "react-icons/fi";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import {
  FilterSelect,
  ListToolbar,
  SearchInput,
} from "@/components/ui/ListToolbar";
import CancelSaleDialog from "@/components/ventas/CancelSaleDialog";
import {
  cancelSale,
  refreshCancellation,
  retryInvoice,
} from "@/components/ventas/sale-actions";
import {
  INVOICE_STATUS,
  InvoiceStatusChip,
  SaleStatusChip,
} from "@/components/ventas/SaleStatusChips";
import { getCustomerName } from "@/src/lib/customer";
import {
  formatCurrency,
  formatDate,
  formatInvoiceCode,
} from "@/src/lib/format";
import { usePaginatedList } from "@/src/lib/hooks/usePaginatedList";
import type { Invoice, Sale } from "@/src/lib/types/sale";

const INITIAL_FILTERS = { q: "", status: "", invoiceStatus: "" };

const SALE_STATUS_OPTIONS = [
  { id: "COMPLETADA", label: "Completadas" },
  { id: "ANULADA", label: "Anuladas" },
];

const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS).map(
  ([id, { label }]) => ({ id, label }),
);

const FILE_LINK_CLASS =
  "inline-flex items-center gap-0.5 text-xs font-medium text-link hover:underline";

function customerLabel(sale: Sale): string {
  return sale.customer ? getCustomerName(sale.customer) : "Clientes varios";
}

function InvoiceSummary({ invoice }: { invoice: Invoice | null }) {
  if (!invoice) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-mono text-xs font-medium text-foreground">
        {formatInvoiceCode(invoice)}
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
    const changed = await cancelSale(sale);
    setIsCancelling(false);

    if (changed) {
      setIsCancelDialogOpen(false);
      reload();
    }
  }, [saleToCancel, reload]);

  const handleEmitInvoice = useCallback(
    async (sale: Sale) => {
      setEmittingSaleId(sale.id);
      if (await retryInvoice(sale)) reload();
      setEmittingSaleId(null);
    },
    [reload],
  );

  const handleRefreshCancellation = useCallback(
    async (sale: Sale) => {
      setRefreshingSaleId(sale.id);
      if (await refreshCancellation(sale)) reload();
      setRefreshingSaleId(null);
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
            <Link
              href={`/admin/ventas/${sale.id}`}
              className="font-medium text-link hover:underline"
              aria-label={`Ver detalle de la venta #${sale.number}`}
            >
              #{sale.number}
            </Link>
            <span className="block text-xs text-muted">
              {formatDate(sale.createdAt)}
            </span>
            {/* En pantallas estrechas el resto de columnas se resume aquí. */}
            <span className="mt-1 block text-xs text-muted md:hidden">
              {customerLabel(sale)}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
              <span className="sm:hidden">
                <SaleStatusChip status={sale.status} />
              </span>
              {sale.invoice ? (
                <span className="font-mono text-xs text-muted">
                  {formatInvoiceCode(sale.invoice)}
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
        cell: (sale) => <SaleStatusChip status={sale.status} />,
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
            <Link
              href="/admin/ventas/nueva"
              className={buttonVariants({ variant: "primary" })}
            >
              <FiPlus aria-hidden />
              Nueva venta
            </Link>
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
