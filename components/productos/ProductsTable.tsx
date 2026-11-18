"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Button, Chip, toast } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { FiEdit2, FiImage, FiLayers, FiTrash2 } from "react-icons/fi";

import CreateProductModal from "@/components/productos/CreateProductModal";
import DeleteProductDialog from "@/components/productos/DeleteProductDialog";
import EditProductModal from "@/components/productos/EditProductModal";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import {
  FilterSelect,
  ListToolbar,
  SearchInput,
} from "@/components/ui/ListToolbar";
import StockLevelChip from "@/components/productos/StockLevelChip";
import { formatCurrency } from "@/src/lib/format";
import { usePaginatedList } from "@/src/lib/hooks/usePaginatedList";
import type {
  CategoriesPageResponse,
  Category,
} from "@/src/lib/types/category";
import type { Product } from "@/src/lib/types/product";

const INITIAL_FILTERS = { q: "", categoryId: "", isActive: "", lowStock: "" };

const STATUS_OPTIONS = [
  { id: "true", label: "Activos" },
  { id: "false", label: "Inactivos" },
];

const STOCK_OPTIONS = [{ id: "true", label: "Solo stock bajo" }];

function StatusChip({ isActive }: { isActive: boolean }) {
  return (
    <Chip color={isActive ? "success" : "default"} size="sm" variant="soft">
      <Chip.Label>{isActive ? "Activo" : "Inactivo"}</Chip.Label>
    </Chip>
  );
}

/** Categorías para el filtro y para los formularios de producto. */
function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/categorias?page=1&pageSize=100", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: CategoriesPageResponse | null) => {
        if (payload?.data) setCategories(payload.data);
      })
      .catch(() => {
        // Sin categorías el filtro queda vacío; la tabla sigue funcionando.
      });

    return () => controller.abort();
  }, []);

  return categories;
}

export default function ProductsTable() {
  const list = usePaginatedList<Product, typeof INITIAL_FILTERS>({
    endpoint: "/api/productos",
    initialFilters: INITIAL_FILTERS,
    loadErrorMessage: "No se pudieron cargar los productos.",
  });
  const { reloadAfterRemoval, setFilter } = list;
  const categories = useCategories();

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const categoryOptions = useMemo(
    () => categories.map(({ id, name }) => ({ id, label: name })),
    [categories],
  );

  const handleDelete = useCallback(async () => {
    const product = productToDelete;
    if (!product) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/productos/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo eliminar el producto.",
        );
      }

      toast.success("Producto eliminado", {
        description: `Se eliminó "${product.name}" correctamente.`,
      });

      setIsDeleteDialogOpen(false);
      reloadAfterRemoval();
    } catch (error) {
      toast.danger("No se pudo eliminar el producto", {
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [productToDelete, reloadAfterRemoval]);

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: "name",
        header: "Producto",
        isRowHeader: true,
        isPrimary: true,
        cell: (product) => (
          <div className="flex items-center gap-3">
            <Avatar size="md" color="accent" className="max-sm:hidden">
              {product.imageUrl ? (
                <Avatar.Image src={product.imageUrl} alt="" />
              ) : null}
              <Avatar.Fallback>
                <FiImage aria-hidden />
              </Avatar.Fallback>
            </Avatar>

            <div className="min-w-0">
              <span className="block font-medium text-foreground">
                {product.name}
              </span>
              <span className="block text-xs text-muted">{product.sku}</span>
              <span className="tabular mt-1 block text-xs text-muted sm:hidden">
                {formatCurrency(product.price)} · Stock: {product.stock}
                {product.isActive ? "" : " · Inactivo"}
              </span>
              <span className="mt-1 block sm:hidden">
                <StockLevelChip product={product} />
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "category",
        header: "Categoría",
        hideBelow: "lg",
        cell: (product) => product.category?.name ?? "—",
      },
      {
        id: "price",
        header: "Precio",
        hideBelow: "sm",
        align: "end",
        cell: (product) => (
          <span className="tabular whitespace-nowrap">
            {formatCurrency(product.price)}
          </span>
        ),
      },
      {
        id: "stock",
        header: "Stock",
        hideBelow: "sm",
        align: "end",
        cell: (product) => (
          <span className="inline-flex flex-col items-end gap-1">
            <span className="tabular">{product.stock}</span>
            <StockLevelChip product={product} />
          </span>
        ),
      },
      {
        id: "status",
        header: "Estado",
        hideBelow: "md",
        cell: (product) => <StatusChip isActive={product.isActive} />,
      },
      {
        id: "actions",
        header: "Acciones",
        align: "center",
        cell: (product) => (
          <div className="flex items-center justify-center gap-1">
            <Link
              href={`/admin/kardex?productId=${product.id}`}
              aria-label={`Kárdex de ${product.name}`}
              title="Ver kárdex"
              className={buttonVariants({
                isIconOnly: true,
                size: "sm",
                variant: "ghost",
              })}
            >
              <FiLayers aria-hidden />
            </Link>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={`Editar ${product.name}`}
              onPress={() => {
                setProductToEdit(product);
                setIsEditDialogOpen(true);
              }}
            >
              <FiEdit2 aria-hidden />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={`Eliminar ${product.name}`}
              onPress={() => {
                setProductToDelete(product);
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
        actions={
          <CreateProductModal
            categories={categories}
            onCreated={list.reloadFromStart}
          />
        }
        summary={
          list.status === "success"
            ? `${total} ${total === 1 ? "producto" : "productos"}${list.hasActiveFilters ? " con esos filtros" : ""}`
            : list.status === "loading"
              ? "Cargando productos..."
              : ""
        }
      >
        <SearchInput
          label="Buscar productos"
          placeholder="Buscar por nombre o SKU"
          onSearch={(query) => setFilter("q", query)}
        />
        <FilterSelect
          label="Categoría"
          allLabel="Todas las categorías"
          value={list.filters.categoryId}
          options={categoryOptions}
          onChange={(value) => setFilter("categoryId", value)}
        />
        <FilterSelect
          label="Estado"
          allLabel="Todos los estados"
          value={list.filters.isActive}
          options={STATUS_OPTIONS}
          onChange={(value) => setFilter("isActive", value)}
        />
        <FilterSelect
          label="Stock"
          allLabel="Todo el stock"
          value={list.filters.lowStock}
          options={STOCK_OPTIONS}
          onChange={(value) => setFilter("lowStock", value)}
        />
      </ListToolbar>

      <DataTable
        ariaLabel="Listado de productos"
        columns={columns}
        items={list.items}
        getRowId={(product) => product.id}
        status={list.status}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRetry={list.reload}
        errorTitle="No se pudieron cargar los productos."
        errorMessage={list.errorMessage}
        emptyMessage={
          list.hasActiveFilters
            ? "Ningún producto coincide con los filtros."
            : "No hay productos registrados."
        }
      />

      <EditProductModal
        product={productToEdit}
        categories={categories}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdated={list.reload}
      />

      <DeleteProductDialog
        product={productToDelete}
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
