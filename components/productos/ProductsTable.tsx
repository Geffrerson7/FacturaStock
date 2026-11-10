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
import { FiEdit2, FiFolder, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import Link from "next/link";

import CreateProductModal from "@/components/productos/CreateProductModal";
import DeleteProductDialog from "@/components/productos/DeleteProductDialog";
import EditProductModal from "@/components/productos/EditProductModal";
import { formatCurrency } from "@/src/lib/format";
import type {
  CategoriesPageResponse,
  Category,
} from "@/src/lib/types/category";
import type {
  Product,
  ProductsPageResponse,
} from "@/src/lib/types/product";
import type { PaginationMeta } from "@/src/lib/types/pagination";

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

export default function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] =
    useState<PaginationMeta>(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/productos?page=${page}&pageSize=${PAGE_SIZE}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/categorias?page=1&pageSize=100", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const productsPayload = (await productsResponse
          .json()
          .catch(() => null)) as
          | (ProductsPageResponse & ErrorPayload)
          | null;
        const categoriesPayload = (await categoriesResponse
          .json()
          .catch(() => null)) as
          | (CategoriesPageResponse & ErrorPayload)
          | null;

        if (!productsResponse.ok) {
          throw new Error(
            productsPayload?.error?.message ??
              "No se pudieron cargar los productos.",
          );
        }

        if (!productsPayload) {
          throw new Error("El servidor devolvió una respuesta inválida.");
        }

        setProducts(productsPayload.data);
        setPagination(productsPayload.pagination);
        setCategories(categoriesPayload?.data ?? []);
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
    const product = productToDelete;
    if (!product) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/productos/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ErrorPayload | null;

        throw new Error(
          payload?.error?.message ?? "No se pudo eliminar el producto.",
        );
      }

      toast.success("Producto eliminado", {
        description: `Se eliminó "${product.name}" correctamente.`,
      });

      setIsDeleteDialogOpen(false);

      if (products.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadToken((token) => token + 1);
      }
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
  }, [productToDelete, products.length, page]);

  const total = pagination.total;
  const totalPages = pagination.totalPages;
  const start = total === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const end = Math.min(page * pagination.pageSize, total);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {status === "success"
            ? `${total} ${total === 1 ? "producto registrado" : "productos registrados"}`
            : "Cargando productos..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/categorias"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <FiFolder aria-hidden />
            Categorías
          </Link>
          <CreateProductModal categories={categories} onCreated={refresh} />
        </div>
      </div>

      {status === "loading" && products.length === 0 ? (
        <div className="flex justify-center rounded-xl border border-slate-200 py-16">
          <Spinner aria-label="Cargando productos" />
        </div>
      ) : status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">No se pudieron cargar los productos.</p>
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
              aria-label="Listado de productos"
              className="min-w-[980px]"
            >
              <Table.Header>
                <Table.Column id="sku" isRowHeader>
                  SKU
                </Table.Column>
                <Table.Column id="name">Producto</Table.Column>
                <Table.Column id="category">Categoría</Table.Column>
                <Table.Column id="price">Precio</Table.Column>
                <Table.Column id="stock">Stock</Table.Column>
                <Table.Column id="status">Estado</Table.Column>
                <Table.Column id="actions" className="text-center">
                  Acciones
                </Table.Column>
              </Table.Header>

              <Table.Body
                renderEmptyState={() => (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No hay productos registrados.
                  </div>
                )}
              >
                {products.map((product) => (
                  <Table.Row key={product.id} id={product.id}>
                    <Table.Cell>{product.sku}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {product.name}
                        </span>
                        {product.description ? (
                          <span className="text-xs text-slate-500">
                            {product.description}
                          </span>
                        ) : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{product.category?.name ?? "—"}</Table.Cell>
                    <Table.Cell>{formatCurrency(product.price)}</Table.Cell>
                    <Table.Cell>
                      <span
                        className={
                          product.stock === 0
                            ? "font-medium text-red-600"
                            : undefined
                        }
                      >
                        {product.stock}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={product.isActive ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        <Chip.Label>
                          {product.isActive ? "Activo" : "Inactivo"}
                        </Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-center gap-1">
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

      <EditProductModal
        product={productToEdit}
        categories={categories}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdated={handleUpdated}
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
