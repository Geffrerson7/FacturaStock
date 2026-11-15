"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Chip, toast } from "@heroui/react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

import CreateCustomerModal from "@/components/clientes/CreateCustomerModal";
import DeleteCustomerDialog from "@/components/clientes/DeleteCustomerDialog";
import EditCustomerModal from "@/components/clientes/EditCustomerModal";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import {
  FilterSelect,
  ListToolbar,
  SearchInput,
} from "@/components/ui/ListToolbar";
import { getCustomerDocument, getCustomerName } from "@/src/lib/customer";
import { usePaginatedList } from "@/src/lib/hooks/usePaginatedList";
import type { Customer } from "@/src/lib/types/customer";

const INITIAL_FILTERS = { q: "", documentType: "" };

const DOCUMENT_TYPE_OPTIONS = [
  { id: "DNI", label: "DNI" },
  { id: "RUC", label: "RUC" },
];

function CustomerDocument({ customer }: { customer: Customer }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Chip size="sm" variant="soft">
        <Chip.Label>{customer.documentType}</Chip.Label>
      </Chip>
      <span className="tabular">{getCustomerDocument(customer)}</span>
    </span>
  );
}

export default function CustomersTable() {
  const list = usePaginatedList<Customer, typeof INITIAL_FILTERS>({
    endpoint: "/api/clientes",
    initialFilters: INITIAL_FILTERS,
    loadErrorMessage: "No se pudieron cargar los clientes.",
  });
  const { reloadAfterRemoval, setFilter } = list;

  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    const customer = customerToDelete;
    if (!customer) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/clientes/${customer.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo eliminar al cliente.",
        );
      }

      toast.success("Cliente eliminado", {
        description: `Se eliminó a ${getCustomerName(customer)} correctamente.`,
      });

      setIsDeleteDialogOpen(false);
      reloadAfterRemoval();
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
  }, [customerToDelete, reloadAfterRemoval]);

  const columns = useMemo<DataTableColumn<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Cliente",
        isRowHeader: true,
        isPrimary: true,
        cell: (customer) => (
          <>
            <span className="font-medium text-foreground">
              {getCustomerName(customer)}
            </span>
            <span className="mt-1 block text-xs text-muted sm:hidden">
              {customer.documentType} {getCustomerDocument(customer)}
            </span>
          </>
        ),
      },
      {
        id: "document",
        header: "Documento",
        hideBelow: "sm",
        cell: (customer) => <CustomerDocument customer={customer} />,
      },
      {
        id: "address",
        header: "Dirección",
        hideBelow: "xl",
        cell: (customer) => customer.address,
      },
      {
        id: "phone",
        header: "Teléfono",
        hideBelow: "md",
        cell: (customer) => customer.phone || "—",
      },
      {
        id: "email",
        header: "Correo electrónico",
        hideBelow: "lg",
        cell: (customer) => customer.email || "—",
      },
      {
        id: "actions",
        header: "Acciones",
        align: "center",
        cell: (customer) => (
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
        ),
      },
    ],
    [],
  );

  const total = list.pagination.total;

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        actions={<CreateCustomerModal onCreated={list.reloadFromStart} />}
        summary={
          list.status === "success"
            ? `${total} ${total === 1 ? "cliente" : "clientes"}${list.hasActiveFilters ? " con esos filtros" : ""}`
            : list.status === "loading"
              ? "Cargando clientes..."
              : ""
        }
      >
        <SearchInput
          label="Buscar clientes"
          placeholder="Nombre, DNI, RUC o correo"
          onSearch={(query) => setFilter("q", query)}
        />
        <FilterSelect
          label="Tipo de documento"
          allLabel="Todos los documentos"
          value={list.filters.documentType}
          options={DOCUMENT_TYPE_OPTIONS}
          onChange={(value) => setFilter("documentType", value)}
        />
      </ListToolbar>

      <DataTable
        ariaLabel="Listado de clientes"
        columns={columns}
        items={list.items}
        getRowId={(customer) => customer.id}
        status={list.status}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRetry={list.reload}
        errorTitle="No se pudieron cargar los clientes."
        errorMessage={list.errorMessage}
        emptyMessage={
          list.hasActiveFilters
            ? "Ningún cliente coincide con los filtros."
            : "No hay clientes registrados."
        }
      />

      <EditCustomerModal
        customer={customerToEdit}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdated={list.reload}
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
