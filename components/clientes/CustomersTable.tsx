"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Pagination, Spinner, Table, toast } from "@heroui/react";
import { FiEdit2, FiRefreshCw, FiTrash2 } from "react-icons/fi";

import CreateCustomerModal from "@/components/clientes/CreateCustomerModal";
import DeleteCustomerDialog from "@/components/clientes/DeleteCustomerDialog";
import EditCustomerModal from "@/components/clientes/EditCustomerModal";
import { getCustomerDocument, getCustomerName } from "@/src/lib/customer";
import type {
  Customer,
  CustomersPageResponse,
  PaginationMeta,
} from "@/src/lib/types/customer";

const PAGE_SIZE = 10;
const PAGE_WINDOW = 1;

type LoadStatus = "loading" | "success" | "error";

type ErrorPayload = {
  error?: { message?: string };
};

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

export default function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] =
    useState<PaginationMeta>(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/clientes?page=${page}&pageSize=${PAGE_SIZE}`,
          { cache: "no-store", signal: controller.signal },
        );

        const payload = (await response
          .json()
          .catch(() => null)) as
          | (CustomersPageResponse & ErrorPayload)
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? "No se pudieron cargar los clientes.",
          );
        }

        if (!payload) {
          throw new Error("El servidor devolvió una respuesta inválida.");
        }

        setCustomers(payload.data);
        setPagination(payload.pagination);
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

    void loadCustomers();

    return () => controller.abort();
  }, [page, reloadToken]);

  const refresh = useCallback(() => {
    setPage(1);
    setReloadToken((token) => token + 1);
  }, []);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleUpdated = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleDelete = useCallback(async () => {
    const customer = customerToDelete;
    if (!customer) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/clientes/${customer.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ErrorPayload | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo eliminar al cliente.",
        );
      }

      toast.success("Cliente eliminado", {
        description: `Se eliminó a ${getCustomerName(customer)} correctamente.`,
      });

      setIsDeleteDialogOpen(false);

      // Si era el único registro de la página, retrocede para no quedar vacío.
      if (customers.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadToken((token) => token + 1);
      }
    } catch (error) {
      toast.danger("No se pudo eliminar al cliente", {
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [customerToDelete, customers.length, page]);

  const total = pagination.total;
  const totalPages = pagination.totalPages;
  const start = total === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const end = Math.min(page * pagination.pageSize, total);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {status === "success"
            ? `${total} ${total === 1 ? "cliente registrado" : "clientes registrados"}`
            : "Cargando clientes..."}
        </p>
        <CreateCustomerModal onCreated={refresh} />
      </div>

      {status === "loading" && customers.length === 0 ? (
        <div className="flex justify-center rounded-xl border border-slate-200 py-16">
          <Spinner aria-label="Cargando clientes" />
        </div>
      ) : status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">No se pudieron cargar los clientes.</p>
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
              aria-label="Listado de clientes"
              className="min-w-[860px]"
            >
              <Table.Header>
                <Table.Column id="document" isRowHeader>
                  Documento
                </Table.Column>
                <Table.Column id="name">Cliente</Table.Column>
                <Table.Column id="address">Dirección</Table.Column>
                <Table.Column id="phone">Teléfono</Table.Column>
                <Table.Column id="email">Correo electrónico</Table.Column>
                <Table.Column id="actions" className="text-center">
                  Acciones
                </Table.Column>
              </Table.Header>

              <Table.Body
                renderEmptyState={() => (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No hay clientes registrados.
                  </div>
                )}
              >
                {customers.map((customer) => (
                  <Table.Row key={customer.id} id={customer.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          {customer.documentType}
                        </span>
                        <span>{getCustomerDocument(customer)}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-slate-900">
                        {getCustomerName(customer)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{customer.address}</Table.Cell>
                    <Table.Cell>{customer.phone || "—"}</Table.Cell>
                    <Table.Cell>{customer.email || "—"}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={`Editar a ${getCustomerName(customer)}`}
                          onPress={() => {
                            setCustomerToEdit(customer);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <FiEdit2 aria-hidden />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={`Eliminar a ${getCustomerName(customer)}`}
                          onPress={() => {
                            setCustomerToDelete(customer);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <FiTrash2 aria-hidden />
                        </Button>
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

      <EditCustomerModal
        customer={customerToEdit}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdated={handleUpdated}
      />

      <DeleteCustomerDialog
        customer={customerToDelete}
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
