import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiFileText,
  FiPlus,
  FiShoppingBag,
} from "react-icons/fi";

import SalesChart from "@/components/dashboard/SalesChart";
import StockLevelChip from "@/components/productos/StockLevelChip";
import PageHeader from "@/components/ui/PageHeader";
import {
  InvoiceStatusChip,
  SaleStatusChip,
} from "@/components/ventas/SaleStatusChips";
import { getCustomerName } from "@/src/lib/customer";
import { getDashboardData, type DashboardData } from "@/src/lib/dashboard";
import {
  formatCents,
  formatCurrency,
  formatDate,
  formatInvoiceCode,
} from "@/src/lib/format";
import { getCurrentUser } from "@/src/lib/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

const CARD = "rounded-xl border border-border bg-surface shadow-surface";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de ventas, comprobantes y stock de tu tienda."
        actions={
          <Link
            href="/admin/ventas/nueva"
            className={buttonVariants({ variant: "primary" })}
          >
            <FiPlus aria-hidden />
            Nueva venta
          </Link>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  // La sesión se comprueba junto a los datos, no solo en el layout. Leerla
  // también hace que la página se calcule en cada petición.
  await getCurrentUser();
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <StatGrid data={data} />
      <SalesChart days={data.salesByDay} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentSales sales={data.recentSales} />
        <LowStock lowStock={data.lowStock} />
      </div>
    </div>
  );
}

function salesCount(count: number): string {
  return `${count} ${count === 1 ? "venta" : "ventas"}`;
}

function StatGrid({ data }: { data: DashboardData }) {
  const { today, month, invoices } = data;

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={FiShoppingBag}
        label="Ventas de hoy"
        value={formatCents(today.totalCents)}
        detail={salesCount(today.count)}
      />
      <StatCard
        icon={FiCalendar}
        label="Ventas del mes"
        value={formatCents(month.totalCents)}
        detail={salesCount(month.count)}
      />
      <StatCard
        icon={FiFileText}
        label="Comprobantes emitidos"
        value={String(invoices.issuedThisMonth)}
        detail="En lo que va del mes"
      />
      <StatCard
        icon={FiAlertTriangle}
        label="Comprobantes pendientes"
        value={String(invoices.pending)}
        detail={
          invoices.pending > 0
            ? "Reintenta la emisión desde Ventas"
            : "Ninguno por emitir"
        }
        note={
          invoices.pendingCancellations > 0
            ? `${invoices.pendingCancellations} ${
                invoices.pendingCancellations === 1
                  ? "anulación espera"
                  : "anulaciones esperan"
              } respuesta de SUNAT`
            : undefined
        }
        tone={invoices.pending > 0 ? "warning" : "default"}
        href={invoices.pending > 0 ? "/admin/ventas" : undefined}
      />
    </ul>
  );
}

type StatCardProps = {
  icon: IconType;
  label: string;
  value: string;
  detail: string;
  note?: string;
  tone?: "default" | "warning";
  href?: string;
};

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  note,
  tone = "default",
  href,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        <span
          className={`flex size-8 items-center justify-center rounded-lg ${
            tone === "warning"
              ? "bg-warning-soft text-warning-soft-foreground"
              : "bg-accent-soft text-accent-soft-foreground"
          }`}
        >
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
      <p
        className={`mt-1 text-xs ${
          tone === "warning" ? "font-medium text-warning" : "text-muted"
        }`}
      >
        {detail}
      </p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </>
  );

  return (
    <li className={CARD}>
      {href ? (
        <Link
          href={href}
          className="block h-full rounded-xl p-4 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-5"
        >
          {body}
        </Link>
      ) : (
        <div className="p-4 sm:p-5">{body}</div>
      )}
    </li>
  );
}

function CardHeader({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-separator px-4 py-3 sm:px-5">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
      >
        {linkLabel}
        <FiArrowRight aria-hidden />
      </Link>
    </div>
  );
}

function RecentSales({ sales }: { sales: DashboardData["recentSales"] }) {
  return (
    <section aria-labelledby="recent-sales" className={CARD}>
      <CardHeader
        id="recent-sales"
        title="Últimas ventas"
        href="/admin/ventas"
        linkLabel="Ver todas"
      />
      {sales.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted sm:px-5">
          Todavía no hay ventas registradas.
        </p>
      ) : (
        <ul className="divide-y divide-separator">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link
                href={`/admin/ventas/${sale.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    #{sale.number} ·{" "}
                    {sale.customer
                      ? getCustomerName(sale.customer)
                      : "Clientes varios"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(sale.createdAt)}
                    {sale.invoice ? ` · ${formatInvoiceCode(sale.invoice)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-sm font-medium text-foreground">
                    {formatCurrency(sale.total.toString())}
                  </span>
                  {sale.status === "ANULADA" ? (
                    <SaleStatusChip status={sale.status} />
                  ) : sale.invoice && sale.invoice.status !== "EMITIDO" ? (
                    <InvoiceStatusChip status={sale.invoice.status} />
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LowStock({ lowStock }: { lowStock: DashboardData["lowStock"] }) {
  const hidden = lowStock.count - lowStock.products.length;

  return (
    <section aria-labelledby="low-stock" className={CARD}>
      <CardHeader
        id="low-stock"
        title="Stock bajo"
        href="/admin/productos"
        linkLabel="Ver productos"
      />
      {lowStock.products.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted sm:px-5">
          Todos los productos activos tienen stock suficiente.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-separator">
            {lowStock.products.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </p>
                  <p className="text-xs text-muted">
                    {product.sku} · aviso con {product.lowStockThreshold} o
                    menos
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-sm font-medium text-foreground">
                    {product.stock} {product.stock === 1 ? "unidad" : "unidades"}
                  </span>
                  <StockLevelChip product={product} />
                </div>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <p className="border-t border-separator px-4 py-3 text-xs text-muted sm:px-5">
              Y {hidden} {hidden === 1 ? "producto más" : "productos más"} con
              stock bajo. Filtra por «Solo stock bajo» en Productos.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Cargando indicadores" className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
