"use client";

import { Button, Pagination, Skeleton, Table } from "@heroui/react";
import { FiRefreshCw } from "react-icons/fi";

import type { ListStatus } from "@/src/lib/hooks/usePaginatedList";
import { getPageItems } from "@/src/lib/pagination";
import type { PaginationMeta } from "@/src/lib/types/pagination";

type Breakpoint = "sm" | "md" | "lg" | "xl";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  /** Columna que identifica la fila para lectores de pantalla. */
  isRowHeader?: boolean;
  /**
   * Columna principal: en móvil ocupa el ancho sobrante y su contenido se
   * ajusta en vez de ensanchar la tabla.
   */
  isPrimary?: boolean;
  /** La columna se oculta por debajo de este ancho de pantalla. */
  hideBelow?: Breakpoint;
  align?: "start" | "center" | "end";
};

type DataTableProps<T> = {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  items: T[];
  getRowId: (item: T) => string;
  status: ListStatus;
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  /** Título del aviso cuando falla la carga. */
  errorTitle: string;
  errorMessage: string | null;
  emptyMessage: string;
};

// Clases completas (no interpoladas) para que Tailwind las detecte.
const VISIBILITY: Record<Breakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGNMENT = {
  start: "",
  center: "text-center",
  end: "text-end",
} as const;

const PRIMARY = "max-sm:w-full max-sm:max-w-0 max-sm:break-words";

const SKELETON_ROWS = 5;

function columnClass<T>(column: DataTableColumn<T>): string {
  return [
    column.hideBelow ? VISIBILITY[column.hideBelow] : "",
    ALIGNMENT[column.align ?? "start"],
    column.isPrimary ? PRIMARY : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Tabla de listado compartida: esqueleto de carga, aviso de error con
 * reintento, estado vacío, columnas que se ocultan en pantallas estrechas y
 * paginación.
 */
export default function DataTable<T>({
  ariaLabel,
  columns,
  items,
  getRowId,
  status,
  pagination,
  onPageChange,
  onRetry,
  errorTitle,
  errorMessage,
  emptyMessage,
}: DataTableProps<T>) {
  if (status === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl bg-danger-soft p-5 text-sm text-danger-soft-foreground"
      >
        <p className="font-medium">{errorTitle}</p>
        {errorMessage ? <p className="mt-1">{errorMessage}</p> : null}
        <Button className="mt-4" size="sm" variant="outline" onPress={onRetry}>
          <FiRefreshCw aria-hidden />
          Reintentar
        </Button>
      </div>
    );
  }

  const isFirstLoad = status === "loading" && items.length === 0;
  const { page, pageSize, total, totalPages } = pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <Table>
      <Table.ScrollContainer
        aria-busy={status === "loading"}
        className={
          status === "loading" && !isFirstLoad
            ? "opacity-60 transition-opacity"
            : undefined
        }
      >
        <Table.Content aria-label={ariaLabel}>
          <Table.Header>
            {columns.map((column) => (
              <Table.Column
                key={column.id}
                id={column.id}
                isRowHeader={column.isRowHeader}
                className={columnClass(column)}
              >
                {column.header}
              </Table.Column>
            ))}
          </Table.Header>

          <Table.Body
            renderEmptyState={() => (
              <div className="px-4 py-10 text-center text-sm text-muted">
                {emptyMessage}
              </div>
            )}
          >
            {isFirstLoad
              ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                  <Table.Row key={`skeleton-${rowIndex}`} id={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <Table.Cell key={column.id} className={columnClass(column)}>
                        <Skeleton className="h-5 w-full min-w-10 rounded-md" />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              : items.map((item) => (
                  <Table.Row key={getRowId(item)} id={getRowId(item)}>
                    {columns.map((column) => (
                      <Table.Cell key={column.id} className={columnClass(column)}>
                        {column.cell(item)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {status === "success" && total > 0 ? (
        <Table.Footer>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <Pagination.Summary className="whitespace-nowrap">
              {start}–{end} de {total}
            </Pagination.Summary>

            <Pagination size="sm" className="w-auto">
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous
                    aria-label="Página anterior"
                    isDisabled={page <= 1}
                    onPress={() => onPageChange(page - 1)}
                  >
                    <Pagination.PreviousIcon />
                    <span className="hidden sm:inline">Anterior</span>
                  </Pagination.Previous>
                </Pagination.Item>

                {getPageItems(page, totalPages).map((item, index) =>
                  item === "ellipsis" ? (
                    <Pagination.Item
                      key={`ellipsis-${index}`}
                      className="hidden sm:block"
                    >
                      <Pagination.Ellipsis />
                    </Pagination.Item>
                  ) : (
                    <Pagination.Item
                      key={item}
                      // En móvil solo queda la página actual entre las flechas.
                      className={item === page ? undefined : "hidden sm:block"}
                    >
                      <Pagination.Link
                        isActive={item === page}
                        onPress={() => onPageChange(item)}
                      >
                        {item}
                      </Pagination.Link>
                    </Pagination.Item>
                  ),
                )}

                <Pagination.Item>
                  <Pagination.Next
                    aria-label="Página siguiente"
                    isDisabled={page >= totalPages}
                    onPress={() => onPageChange(page + 1)}
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </div>
        </Table.Footer>
      ) : null}
    </Table>
  );
}
