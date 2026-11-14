"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Input, Label, Spinner, TextField } from "@heroui/react";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

type SearchResponse<T> = {
  data?: T[];
  pagination?: { total: number };
  error?: { message?: string };
};

type SearchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: T[]; total: number };

type SearchPickerProps<T> = {
  label: string;
  placeholder: string;
  /** Listado de la API que acepta `q` y `pageSize`; puede traer más filtros. */
  endpoint: string;
  emptyMessage: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  isItemDisabled?: (item: T) => boolean;
  onSelect: (item: T) => void;
};

/**
 * Buscador que consulta al servidor mientras se escribe y muestra unos pocos
 * resultados para elegir. Reemplaza a los desplegables que cargaban el
 * listado completo en el navegador.
 */
export default function SearchPicker<T>({
  label,
  placeholder,
  endpoint,
  emptyMessage,
  getKey,
  renderItem,
  isItemDisabled,
  onSelect,
}: SearchPickerProps<T>) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SearchState<T>>({ status: "idle" });

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    async function search() {
      setState({ status: "loading" });

      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("q", query.trim());
        url.searchParams.set("page", "1");
        url.searchParams.set("pageSize", String(RESULT_LIMIT));

        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response
          .json()
          .catch(() => null)) as SearchResponse<T> | null;

        if (!response.ok || !payload?.data) {
          throw new Error(
            payload?.error?.message ?? "No se pudo completar la búsqueda.",
          );
        }

        setState({
          status: "success",
          items: payload.data,
          total: payload.pagination?.total ?? payload.data.length,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo completar la búsqueda.",
        });
      }
    }

    // Espera a que se deje de escribir antes de consultar.
    const timer = window.setTimeout(() => void search(), DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, isOpen, query]);

  function handleSelect(item: T) {
    onSelect(item);
    setQuery("");
    setIsOpen(false);
    setState({ status: "idle" });
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        value={query}
        onChange={(value) => {
          setQuery(value);
          setIsOpen(true);
        }}
      >
        <Label>{label}</Label>
        <Input
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            // Enter no debe enviar el formulario que contiene al buscador.
            if (event.key === "Enter") event.preventDefault();
            if (event.key === "Escape" && isOpen) {
              event.stopPropagation();
              setIsOpen(false);
            }
          }}
        />
      </TextField>

      {isOpen ? (
        <div
          className="rounded-xl border border-slate-200 bg-white"
          aria-live="polite"
        >
          {state.status === "loading" || state.status === "idle" ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" aria-label="Buscando" />
            </div>
          ) : state.status === "error" ? (
            <p className="px-3 py-3 text-sm text-red-700">{state.message}</p>
          ) : state.items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            <>
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {state.items.map((item) => {
                  const isDisabled = isItemDisabled?.(item) ?? false;

                  return (
                    <li key={getKey(item)}>
                      <button
                        type="button"
                        disabled={isDisabled}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleSelect(item)}
                      >
                        {renderItem(item)}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {state.total > state.items.length ? (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  Mostrando {state.items.length} de {state.total}. Escribe para
                  afinar la búsqueda.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
