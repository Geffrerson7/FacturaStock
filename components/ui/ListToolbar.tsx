"use client";

import { useEffect, useRef, useState } from "react";
import { ListBox, SearchField, Select } from "@heroui/react";

const SEARCH_DEBOUNCE_MS = 300;

type ListToolbarProps = {
  /** Buscador y filtros. */
  children?: React.ReactNode;
  /** Botones de acción (crear, actualizar...). */
  actions?: React.ReactNode;
  /** Resumen del resultado, por ejemplo "12 productos". */
  summary: string;
};

/** Barra sobre una tabla: búsqueda y filtros a un lado, acciones al otro. */
export function ListToolbar({ children, actions, summary }: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {children}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}

type SearchInputProps = {
  label: string;
  placeholder: string;
  /** Recibe el texto ya recortado, tras una breve pausa al escribir. */
  onSearch: (query: string) => void;
};

export function SearchInput({ label, placeholder, onSearch }: SearchInputProps) {
  const [value, setValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);

    if (timer.current) clearTimeout(timer.current);

    // Al vaciar el campo el listado vuelve de inmediato, sin esperar.
    if (next.trim() === "") {
      onSearch("");
      return;
    }

    timer.current = setTimeout(() => onSearch(next.trim()), SEARCH_DEBOUNCE_MS);
  }

  return (
    <SearchField
      aria-label={label}
      value={value}
      onChange={handleChange}
      className="w-full sm:w-72"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={placeholder} maxLength={100} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

const ALL = "__all__";

type FilterSelectProps = {
  label: string;
  /** Texto de la opción que quita el filtro, por ejemplo "Todos los estados". */
  allLabel: string;
  /** Valor actual; vacío significa "sin filtro". */
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
};

export function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <Select
      aria-label={label}
      value={value === "" ? ALL : value}
      onChange={(key) =>
        onChange(key === null || key === ALL ? "" : String(key))
      }
      className="w-full sm:w-56"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={ALL} textValue={allLabel}>
            {allLabel}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
