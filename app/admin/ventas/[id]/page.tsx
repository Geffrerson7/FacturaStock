import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";

import PageSkeleton from "@/components/ui/PageSkeleton";
import SaleActions from "@/components/ventas/SaleActions";
import {
  InvoiceStatusChip,
  SaleStatusChip,
} from "@/components/ventas/SaleStatusChips";
import { SALE_INCLUDE } from "@/src/lib/api/sale";
import {
  getCustomerDocumentLabel,
  getCustomerName,
} from "@/src/lib/customer";
import {
  formatCurrency,
  formatDate,
  formatInvoiceCode,
} from "@/src/lib/format";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { saleIdSchema } from "@/src/lib/validations/sale";

export const metadata: Metadata = {
  title: "Detalle de venta",
};

const CARD =
  "rounded-xl border border-border bg-surface p-4 shadow-surface sm:p-5";

export default function SaleDetailPage({
  params,
}: PageProps<"/admin/ventas/[id]">) {
  return (
    <>
      <Link
        href="/admin/ventas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
      >
        <FiArrowLeft aria-hidden />
        Ventas
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <SaleDetail params={params} />
      </Suspense>
    </>
  );
}

async function getSale(id: string) {
  const parsed = saleIdSchema.safeParse(id);
  if (!parsed.success) return null;

  return prisma.sale.findUnique({
    where: { id: parsed.data },
    include: SALE_INCLUDE,
  });
}

async function SaleDetail({
  params,
}: {
  params: PageProps<"/admin/ventas/[id]">["params"];
}) {
  // La sesión se comprueba junto a los datos, no solo en el layout.
  await getCurrentUser();

  const { id } = await params;
  const sale = await getSale(id);

  if (!sale) notFound();

  const invoice = sale.invoice;
  const files = invoice
    ? [
        { label: "PDF", href: invoice.pdfUrl },
        { label: "XML", href: invoice.xmlUrl },
        { label: "CDR", href: invoice.cdrUrl },
      ].filter((file): file is { label: string; href: string } =>
        Boolean(file.href),
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Venta #{sale.number}
            </h1>
            <SaleStatusChip status={sale.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(sale.createdAt)}
          </p>
        </div>
        <SaleActions
          sale={{
            id: sale.id,
            number: sale.number,
            total: sale.total.toString(),
            status: sale.status,
            invoiceStatus: invoice?.status ?? null,
          }}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="sale-items" className={CARD}>
          <h2 id="sale-items" className="mb-3 text-base font-semibold">
            Productos
          </h2>

          <table className="tabular w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-separator">
                <th scope="col" className="py-2 text-start font-medium">
                  Producto
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  Cant.
                </th>
                <th
                  scope="col"
                  className="hidden py-2 text-end font-medium sm:table-cell"
                >
                  Precio
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="py-3 pe-2 text-start font-normal">
                    <span className="block font-medium text-foreground">
                      {item.productName}
                    </span>
                    <span className="block text-xs text-muted sm:hidden">
                      {formatCurrency(item.unitPrice.toString())} c/u
                    </span>
                  </th>
                  <td className="py-3 text-end">{item.quantity}</td>
                  <td className="hidden py-3 text-end sm:table-cell">
                    {formatCurrency(item.unitPrice.toString())}
                  </td>
                  <td className="py-3 text-end font-medium text-foreground">
                    {formatCurrency(item.subtotal.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="tabular mt-4 flex flex-col gap-2 border-t border-separator pt-4 text-sm sm:ms-auto sm:max-w-72">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Base imponible</dt>
              <dd>{formatCurrency(sale.taxableAmount.toString())}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">IGV (18 %)</dt>
              <dd>{formatCurrency(sale.igvAmount.toString())}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-medium">Total</dt>
              <dd className="text-xl font-semibold text-foreground">
                {formatCurrency(sale.total.toString())}
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="sale-customer" className={CARD}>
            <h2 id="sale-customer" className="mb-2 text-base font-semibold">
              Cliente
            </h2>
            {sale.customer ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {getCustomerName(sale.customer)}
                </p>
                <p className="text-sm text-muted">
                  {getCustomerDocumentLabel(sale.customer)}
                </p>
                {sale.customer.address ? (
                  <p className="mt-1 text-sm text-muted">
                    {sale.customer.address}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted">Clientes varios</p>
            )}
          </section>

          <section aria-labelledby="sale-invoice" className={CARD}>
            <h2 id="sale-invoice" className="mb-2 text-base font-semibold">
              Comprobante
            </h2>

            {invoice ? (
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium text-foreground">
                    {formatInvoiceCode(invoice)}
                  </span>
                  <InvoiceStatusChip status={invoice.status} />
                </div>
                <p className="text-muted">
                  {invoice.documentType === "FACTURA" ? "Factura" : "Boleta"}{" "}
                  electrónica
                  {invoice.issuedAt
                    ? ` · emitida el ${formatDate(invoice.issuedAt)}`
                    : ""}
                </p>

                {invoice.sunatDescription ? (
                  <p className="text-muted">
                    <span className="font-medium text-foreground">SUNAT: </span>
                    {invoice.sunatDescription}
                  </p>
                ) : null}

                {invoice.status === "PENDIENTE" && invoice.errorMessage ? (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-soft-foreground">
                    {invoice.errorMessage}
                  </p>
                ) : null}

                {files.length > 0 ? (
                  <ul className="flex flex-wrap gap-3">
                    {files.map((file) => (
                      <li key={file.label}>
                        <a
                          href={file.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-link hover:underline"
                        >
                          {file.label}
                          <FiExternalLink aria-hidden />
                          <span className="sr-only">
                            {" "}
                            (se abre en otra pestaña)
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">
                    Los archivos del comprobante aparecen cuando Nubefact
                    confirma la emisión.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Esta venta no tiene comprobante.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
