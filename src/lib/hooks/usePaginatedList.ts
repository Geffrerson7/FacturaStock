"use client";

import { useCallback, useEffect, useState } from "react";

import type { PaginationMeta } from "@/src/lib/types/pagination";

export type ListStatus = "loading" | "success" | "error";

/** Filtros del listado; un valor vacío significa "sin filtro". */
export type ListFilters = Record<string, string>;

type ListPayload<T> = {
  data?: T[];
  pagination?: PaginationMeta;
  error?: { message?: string };
};

type UsePaginatedListOptions<F extends ListFilters> = {
  /** Endpoint de listado, por ejemplo `/api/productos`. */
  endpoint: string;
  /** Valor inicial de cada filtro; define también qué filtros existen. */
  initialFilters: F;
  /** Mensaje cuando la API falla sin dar uno propio. */
  loadErrorMessage: string;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;

function emptyPagination(pageSize: number): PaginationMeta {
  return {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

/** Arma la URL del listado omitiendo los filtros vacíos. */
export function buildListUrl(
  endpoint: string,
  page: number,
  pageSize: number,
  filters: ListFilters,
): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "") params.set(key, value);
  }

  return `${endpoint}?${params.toString()}`;
}

/**
 * Carga, paginación, filtros y estados de un listado de la API. Lo comparten
 * las tablas de productos, clientes, categorías y ventas.
 */
export function usePaginatedList<T, F extends ListFilters = ListFilters>({
  endpoint,
  initialFilters,
  loadErrorMessage,
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePaginatedListOptions<F>) {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(() =>
    emptyPagination(pageSize),
  );
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<F>(initialFilters);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          buildListUrl(endpoint, page, pageSize, filters),
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as ListPayload<T> | null;

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? loadErrorMessage);
        }

        if (!payload?.data || !payload.pagination) {
          throw new Error("El servidor devolvió una respuesta inválida.");
        }

        setItems(payload.data);
        setPagination(payload.pagination);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(
          error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        );
        setStatus("error");
      }
    }

    void load();

    return () => controller.abort();
  }, [endpoint, page, pageSize, filters, reloadToken, loadErrorMessage]);

  /** Vuelve a pedir la página actual. */
  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  /** Vuelve a la primera página; para después de crear un registro. */
  const reloadFromStart = useCallback(() => {
    setPage(1);
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Para después de eliminar un registro: si era el único de la página,
   * retrocede una para no dejarla vacía.
   */
  const reloadAfterRemoval = useCallback(() => {
    if (items.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      setReloadToken((token) => token + 1);
    }
  }, [items.length, page]);

  /** Cambia un filtro y vuelve a la primera página. */
  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((current) =>
      current[key] === value ? current : { ...current, [key]: value },
    );
    setPage(1);
  }, []);

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  return {
    items,
    pagination,
    page,
    setPage,
    filters,
    setFilter,
    hasActiveFilters,
    status,
    errorMessage,
    reload,
    reloadFromStart,
    reloadAfterRemoval,
  };
}
