"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Pagination,
  Spinner,
  Table,
  toast,
} from "@heroui/react";
import { FiExternalLink, FiRefreshCw, FiXCircle } from "react-icons/fi";

import CancelSaleDialog from "@/components/ventas/CancelSaleDialog";
import CreateSaleModal from "@/components/ventas/CreateSaleModal";
import { formatCurrency, formatDate } from "@/src/lib/format";
import { getCustomerName } from "@/src/lib/customer";
import type { Customer, CustomersPageResponse } from "@/src/lib/types/customer";
import type { PaginationMeta } from "@/src/lib/types/pagination";
import type { Product, ProductsPageResponse } from "@/src/lib/types/product";
import type {
  InvoiceStatus,
  Sale,
  SalesPageResponse,
} from "@/src/lib/types/sale";

const PAGE_SIZE = 10;
const PAGE_WINDOW = 1;

type LoadStatus = "loading" | "success" | "error";

type ErrorPayload = {
  error?: { message?: string };
};

type InvoiceResponsePayload = ErrorPayload & { data?: Sale };

function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "EMITIDO":
      return "Emitido";
    case "PENDIENTE":
      return "Pendiente";
    case "ANULADO":
      return "Anulado";
    case "ANULACION_PENDIENTE":
      return "Anulación pendiente";
  }
}

function invoiceStatusColor(
  status: InvoiceStatus,
): "success" | "warning" | "danger" | "default" {
  switch (status) {
    case "EMITIDO":
      return "success";
    case "PENDIENTE":
      return "warning";
    case "ANULADO":
      return "danger";
    case "ANULACION_PENDIENTE":
      return "default";
  }
}

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function getPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - PAGE_WINDOW);
  const end = Math.min(total - 1, current + PAGE_WINDOW);
  const items: (number | "ellipsis")[] = [1];

  if (start > 2) items.push("ellipsis");

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < total - 1) items.push("ellipsis");

  items.push(total);

  return items;
}

export default function SalesTable() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] =
    useState<PaginationMeta>(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [emittingSaleId, setEmittingSaleId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const [salesResponse, productsResponse, customersResponse] =
          await Promise.all([
            fetch(`/api/ventas?page=${page}&pageSize=${PAGE_SIZE}`, {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch("/api/productos?page=1&pageSize=100", {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch("/api/clientes?page=1&pageSize=100", {
              cache: "no-store",
              signal: controller.signal,
            }),
          ]);

        const salesPayload = (await salesResponse.json().catch(() => null)) as
          | (SalesPageResponse & ErrorPayload)
          | null;
        const productsPayload = (await productsResponse
          .json()
          .catch(() => null)) as
          | (ProductsPageResponse & ErrorPayload)
          | null;
        const customersPayload = (await customersResponse
          .json()
          .catch(() => null)) as
          | (CustomersPageResponse & ErrorPayload)
          | null;

        if (!salesResponse.ok) {
          throw new Error(
            salesPayload?.error?.message ?? "No se pudieron cargar las ventas.",
          );
        }

        if (!salesPayload) {
          throw new Error("El servidor devolvió una respuesta inválida.");
        }

        setSales(salesPayload.data);
        setPagination(salesPayload.pagination);
        setProducts(productsPayload?.data ?? []);
        setCustomers(customersPayload?.data ?? []);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
        );
        setStatus("error");
      }
    }

    void loadData();

    return () => controller.abort();
  }, [page, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleCreated = useCallback(() => {
    setPage(1);
    setReloadToken((token) => token + 1);
  }, []);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

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
          .catch(() => null)) as ErrorPayload | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo anular la venta.",
        );
      }

      toast.success("Venta anulada", {
        description: `La venta #${sale.number} se anuló y el stock fue devuelto.`,
      });

      setIsCancelDialogOpen(false);
      setReloadToken((token) => token + 1);
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
  }, [saleToCancel]);

  const handleEmitInvoice = useCallback(async (sale: Sale) => {
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

      setReloadToken((token) => token + 1);
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
  }, []);

  const total = pagination.total;
  const totalPages = pagination.totalPages;
  const start = total === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const end = Math.min(page * pagination.pageSize, total);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {status === "success"
            ? `${total} ${total === 1 ? "venta registrada" : "ventas registradas"}`
            : "Cargando ventas..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onPress={reload}>
            <FiRefreshCw aria-hidden />
            Actualizar
          </Button>
          <CreateSaleModal
            products={products}
            customers={customers}
            onCreated={handleCreated}
          />
        </div>
      </div>

      {status === "loading" && sales.length === 0 ? (
        <div className="flex justify-center rounded-xl border border-slate-200 py-16">
          <Spinner aria-label="Cargando ventas" />
        </div>
      ) : status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">No se pudieron cargar las ventas.</p>
          <p className="mt-1">{errorMessage}</p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onPress={retry}
          >
            <FiRefreshCw aria-hidden />
            Reintentar
          </Button>
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer
            className={
              status === "loading" ? "opacity-60 transition-opacity" : undefined
            }
          >
            <Table.Content
              aria-label="Listado de ventas"
              className="min-w-[1180px]"
            >
              <Table.Header>
                <Table.Column id="number" isRowHeader>
                  N°
                </Table.Column>
                <Table.Column id="createdAt">Fecha</Table.Column>
                <Table.Column id="customer">Cliente</Table.Column>
                <Table.Column id="items">Productos</Table.Column>
                <Table.Column id="total">Total</Table.Column>
                <Table.Column id="invoice">Comprobante</Table.Column>
                <Table.Column id="status">Estado</Table.Column>
                <Table.Column id="actions" className="text-center">
                  Acciones
                </Table.Column>
              </Table.Header>

              <Table.Body
                renderEmptyState={() => (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No hay ventas registradas.
                  </div>
                )}
              >
                {sales.map((sale) => (
                  <Table.Row key={sale.id} id={sale.id}>
                    <Table.Cell>#{sale.number}</Table.Cell>
                    <Table.Cell>{formatDate(sale.createdAt)}</Table.Cell>
                    <Table.Cell>
                      {sale.customer
                        ? getCustomerName(sale.customer)
                        : "Walk-in"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-0.5">
                        {sale.items.map((item) => (
                          <span key={item.id} className="text-sm">
                            {item.quantity}× {item.productName}
                          </span>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatCurrency(sale.total)}</Table.Cell>
                    <Table.Cell>
                      {sale.invoice ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-medium text-slate-900">
                            {sale.invoice.series}-
                            {String(sale.invoice.number).padStart(8, "0")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Chip
                              color={invoiceStatusColor(sale.invoice.status)}
                              size="sm"
                              variant="soft"
                            >
                              <Chip.Label>
                                {invoiceStatusLabel(sale.invoice.status)}
                              </Chip.Label>
                            </Chip>
                            {sale.invoice.pdfUrl ? (
                              <a
                                className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                                href={sale.invoice.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                PDF
                                <FiExternalLink aria-hidden />
                              </a>
                            ) : null}
                            {sale.invoice.xmlUrl ? (
                              <a
                                className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                                href={sale.invoice.xmlUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                XML
                                <FiExternalLink aria-hidden />
                              </a>
                            ) : null}
                          </div>
                          {sale.invoice.status === "PENDIENTE" &&
                          sale.invoice.errorMessage ? (
                            <span
                              className="max-w-[220px] truncate text-xs text-red-600"
                              title={sale.invoice.errorMessage}
                            >
                              {sale.invoice.errorMessage}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={sale.status === "COMPLETADA" ? "success" : "danger"}
                        size="sm"
                        variant="soft"
                      >
                        <Chip.Label>
                          {sale.status === "COMPLETADA"
                            ? "Completada"
                            : "Anulada"}
                        </Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
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
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>

          {status === "success" && total > 0 ? (
            <Table.Footer>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Pagination.Summary className="whitespace-nowrap">
                  Mostrando {start}–{end} de {total}
                </Pagination.Summary>

                <Pagination size="sm">
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        isDisabled={page <= 1}
                        onPress={() => setPage((current) => current - 1)}
                      >
                        <Pagination.PreviousIcon />
                        Anterior
                      </Pagination.Previous>
                    </Pagination.Item>

                    {getPageItems(page, totalPages).map((item, index) =>
                      item === "ellipsis" ? (
                        <Pagination.Item key={`ellipsis-${index}`}>
                          <Pagination.Ellipsis />
                        </Pagination.Item>
                      ) : (
                        <Pagination.Item key={item}>
                          <Pagination.Link
                            isActive={item === page}
                            onPress={() => setPage(item)}
                          >
                            {item}
                          </Pagination.Link>
                        </Pagination.Item>
                      ),
                    )}

                    <Pagination.Item>
                      <Pagination.Next
                        isDisabled={page >= totalPages}
                        onPress={() => setPage((current) => current + 1)}
                      >
                        Siguiente
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </div>
            </Table.Footer>
          ) : null}
        </Table>
      )}

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
