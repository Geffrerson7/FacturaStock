"use client";

import { useState, type KeyboardEvent } from "react";

import { formatCents } from "@/src/lib/format";
import type { DailySales } from "@/src/lib/dashboard";

type SalesChartProps = {
  days: DailySales[];
};

const PLOT_HEIGHT = "h-48";

// Las fechas llegan como AAAA-MM-DD de Lima; se formatean en UTC para que el
// día no se corra según la zona horaria del navegador.
const shortDate = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const fullAxis = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const compactAxis = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function toDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** Tope del eje y paso entre marcas, en soles, redondeados a 1, 2 o 5 × 10ⁿ. */
function niceScale(maxSoles: number, tickCount = 3) {
  if (maxSoles <= 0) return { top: 100 * tickCount, step: 100 };

  const rough = maxSoles / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((s) => s >= rough) ??
    10 * magnitude;

  return { top: step * tickCount, step };
}

function axisLabel(soles: number, top: number): string {
  return `S/ ${top >= 10_000 ? compactAxis.format(soles) : fullAxis.format(soles)}`;
}

function salesLabel(count: number): string {
  return `${count} ${count === 1 ? "venta" : "ventas"}`;
}

/** Ventas (total con IGV) por día. Una sola serie: el título la nombra. */
export default function SalesChart({ days }: SalesChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const maxCents = Math.max(0, ...days.map((day) => day.totalCents));
  const { top, step } = niceScale(maxCents / 100);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const periodCents = days.reduce((sum, day) => sum + day.totalCents, 0);
  const periodCount = days.reduce((sum, day) => sum + day.count, 0);
  const lastIndex = days.length - 1;
  const activeDay = active === null ? null : days[active];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? lastIndex;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(lastIndex, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : null;

    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  return (
    <section
      aria-labelledby="sales-chart-title"
      className="rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="sales-chart-title" className="text-base font-semibold">
            Ventas por día
          </h2>
          <p className="text-xs text-muted">
            Últimos {days.length} días · total con IGV
          </p>
        </div>
        <div className="text-end">
          <p className="tabular text-lg font-semibold">
            {formatCents(periodCents)}
          </p>
          <p className="text-xs text-muted">{salesLabel(periodCount)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {/* Eje Y */}
        <div
          aria-hidden
          className={`relative w-14 shrink-0 ${PLOT_HEIGHT} text-end text-xs text-muted`}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="tabular absolute right-0 translate-y-1/2 whitespace-nowrap"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {axisLabel(tick, top)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Lectura del día activo, también para lectores de pantalla. */}
          <div
            aria-live="polite"
            className={`pointer-events-none absolute -top-2 z-10 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-overlay ${
              activeDay ? "" : "sr-only"
            }`}
            style={
              activeDay && active !== null
                ? {
                    left: `${((active + 0.5) / days.length) * 100}%`,
                    transform: `translate(${active < days.length / 2 ? "-20%" : "-80%"}, -100%)`,
                  }
                : undefined
            }
          >
            {activeDay ? (
              <>
                <p className="tabular text-sm font-semibold text-foreground">
                  {formatCents(activeDay.totalCents)}
                </p>
                <p className="whitespace-nowrap text-muted">
                  {salesLabel(activeDay.count)} ·{" "}
                  {longDate.format(toDate(activeDay.date))}
                </p>
              </>
            ) : null}
          </div>

          {/* Área del gráfico: se recorre con las flechas del teclado. */}
          <div
            role="group"
            aria-label="Ventas por día. Usa las flechas izquierda y derecha para recorrer los días."
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => setActive((current) => current ?? lastIndex)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className={`relative ${PLOT_HEIGHT} rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus`}
          >
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden
                className="absolute inset-x-0 border-t border-separator"
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-0.5">
              {days.map((day, index) => {
                const height = (day.totalCents / 100 / top) * 100;
                const isActive = active === index;

                return (
                  <div
                    key={day.date}
                    aria-hidden
                    onPointerEnter={() => setActive(index)}
                    className="flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    <div
                      className={`w-full max-w-6 rounded-t-[4px] transition-colors ${
                        isActive ? "bg-accent-hover" : "bg-accent"
                      } ${active !== null && !isActive ? "opacity-60" : ""}`}
                      style={{
                        height: day.totalCents > 0 ? `max(${height}%, 2px)` : 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {periodCount === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Todavía no hay ventas en este periodo.
              </p>
            ) : null}
          </div>

          {/* Eje X: una fecha por semana, contando desde hoy. */}
          <div aria-hidden className="mt-2 flex gap-0.5 text-xs text-muted">
            {days.map((day, index) => (
              <span
                key={day.date}
                className="flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap"
              >
                {index === lastIndex
                  ? "Hoy"
                  : (lastIndex - index) % 7 === 0 && index > 2
                    ? shortDate.format(toDate(day.date))
                    : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-link">
          Ver los datos en una tabla
        </summary>
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="tabular w-full text-sm">
            <caption className="sr-only">Ventas por día</caption>
            <thead className="text-xs text-muted">
              <tr className="border-b border-separator">
                <th scope="col" className="py-1.5 text-start font-medium">
                  Día
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  Ventas
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {[...days].reverse().map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="py-1.5 text-start font-normal">
                    {longDate.format(toDate(day.date))}
                  </th>
                  <td className="py-1.5 text-end">{day.count}</td>
                  <td className="py-1.5 text-end">
                    {formatCents(day.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
