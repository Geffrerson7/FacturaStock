"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Chip, toast } from "@heroui/react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

import CreateCategoryModal from "@/components/categorias/CreateCategoryModal";
import DeleteCategoryDialog from "@/components/categorias/DeleteCategoryDialog";
import EditCategoryModal from "@/components/categorias/EditCategoryModal";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { ListToolbar, SearchInput } from "@/components/ui/ListToolbar";
import { usePaginatedList } from "@/src/lib/hooks/usePaginatedList";
import type { CategoryWithCount } from "@/src/lib/types/category";

const INITIAL_FILTERS = { q: "" };

function productCountLabel(count: number): string {
  return `${count} ${count === 1 ? "producto" : "productos"}`;
}

export default function CategoriesTable() {
  const list = usePaginatedList<CategoryWithCount, typeof INITIAL_FILTERS>({
    endpoint: "/api/categorias",
    initialFilters: INITIAL_FILTERS,
    loadErrorMessage: "No se pudieron cargar las categorías.",
  });
  const { reloadAfterRemoval, setFilter } = list;

  const [categoryToDelete, setCategoryToDelete] =
    useState<CategoryWithCount | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryToEdit, setCategoryToEdit] =
    useState<CategoryWithCount | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    const category = categoryToDelete;
    if (!category) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/categorias/${category.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo eliminar la categoría.",
        );
      }

      toast.success("Categoría eliminada", {
        description: `Se eliminó la categoría "${category.name}".`,
      });

      setIsDeleteDialogOpen(false);
      reloadAfterRemoval();
    } catch (error) {
      toast.danger("No se pudo eliminar la categoría", {
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [categoryToDelete, reloadAfterRemoval]);

  const columns = useMemo<DataTableColumn<CategoryWithCount>[]>(
    () => [
      {
        id: "name",
        header: "Nombre",
        isRowHeader: true,
        isPrimary: true,
        cell: (category) => (
          <>
            <span className="font-medium text-foreground">{category.name}</span>
            <span className="mt-0.5 block text-xs text-muted sm:hidden">
              {productCountLabel(category.productCount)}
            </span>
          </>
        ),
      },
      {
        id: "description",
        header: "Descripción",
        hideBelow: "md",
        cell: (category) => category.description || "—",
      },
      {
        id: "products",
        header: "Productos",
        hideBelow: "sm",
        cell: (category) => (
          <Chip
            color={category.productCount > 0 ? "default" : "warning"}
            size="sm"
            variant="soft"
          >
            <Chip.Label>{productCountLabel(category.productCount)}</Chip.Label>
          </Chip>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        align: "center",
        cell: (category) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={`Editar ${category.name}`}
              onPress={() => {
                setCategoryToEdit(category);
                setIsEditDialogOpen(true);
              }}
            >
              <FiEdit2 aria-hidden />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={`Eliminar ${category.name}`}
              onPress={() => {
                setCategoryToDelete(category);
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
        actions={<CreateCategoryModal onCreated={list.reloadFromStart} />}
        summary={
          list.status === "success"
            ? `${total} ${total === 1 ? "categoría" : "categorías"}${list.hasActiveFilters ? " con esa búsqueda" : ""}`
            : list.status === "loading"
              ? "Cargando categorías..."
              : ""
        }
      >
        <SearchInput
          label="Buscar categorías"
          placeholder="Buscar por nombre"
          onSearch={(query) => setFilter("q", query)}
        />
      </ListToolbar>

      <DataTable
        ariaLabel="Listado de categorías"
        columns={columns}
        items={list.items}
        getRowId={(category) => category.id}
        status={list.status}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRetry={list.reload}
        errorTitle="No se pudieron cargar las categorías."
        errorMessage={list.errorMessage}
        emptyMessage={
          list.hasActiveFilters
            ? "Ninguna categoría coincide con la búsqueda."
            : "No hay categorías registradas."
        }
      />

      <EditCategoryModal
        category={categoryToEdit}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdated={list.reload}
      />

      <DeleteCategoryDialog
        category={categoryToDelete}
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
