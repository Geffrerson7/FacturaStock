import { Prisma } from "@/src/generated/prisma/client";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { emitSaleInvoice } from "@/src/lib/api/invoice";
import {
  paginatedResponse,
  parseJsonBody,
  parseSearchParams,
} from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import {
  buildSaleOrderBy,
  buildSaleWhere,
  SALE_INCLUDE,
} from "@/src/lib/api/sale";
import { prisma } from "@/src/lib/prisma";
import { buildNubefactItems, resolveInvoiceIdentity } from "@/src/lib/nubefact";
import {
  createSaleSchema,
  listSalesQuerySchema,
} from "@/src/lib/validations/sale";

export async function GET(request: Request) {
  try {
    await requireSession(request);

    const query = parseSearchParams(request, listSalesQuerySchema);
    const { page, pageSize } = query;
    const where = buildSaleWhere(query);

    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: buildSaleOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sale.count({ where }),
    ]);

    return paginatedResponse(sales, total, { page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);

    const data = await parseJsonBody(request, createSaleSchema);

    const customer = data.customerId
      ? await prisma.customer.findUnique({
          where: { id: data.customerId },
        })
      : null;

    if (data.customerId && !customer) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "El cliente seleccionado no existe.",
        { field: "customerId" },
      );
    }

    // Agrupa las líneas por producto para validar el stock una sola vez.
    const quantities = new Map<string, number>();
    for (const item of data.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = [...quantities.keys()];

    const sale = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, stock: true, isActive: true },
      });

      const productById = new Map(products.map((product) => [product.id, product]));

      for (const productId of productIds) {
        const product = productById.get(productId);

        if (!product) {
          throw new ApiError(
            400,
            "VALIDATION_ERROR",
            "Uno de los productos seleccionados ya no existe.",
            { field: "items" },
          );
        }

        if (!product.isActive) {
          throw new ApiError(
            409,
            "PRODUCT_INACTIVE",
            `El producto "${product.name}" está inactivo y no se puede vender.`,
            { field: "items" },
          );
        }

        const quantity = quantities.get(productId)!;

        if (product.stock < quantity) {
          throw new ApiError(
            409,
            "INSUFFICIENT_STOCK",
            `No hay stock suficiente de "${product.name}". Disponible: ${product.stock}, solicitado: ${quantity}.`,
            { field: "items" },
          );
        }
      }

      for (const [productId, quantity] of quantities) {
        const result = await tx.product.updateMany({
          where: { id: productId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });

        // Otra venta pudo consumir el stock entre la lectura y la escritura.
        if (result.count === 0) {
          const product = productById.get(productId)!;
          throw new ApiError(
            409,
            "INSUFFICIENT_STOCK",
            `No hay stock suficiente de "${product.name}". Otra venta acaba de consumirlo.`,
            { field: "items" },
          );
        }
      }

      // Una línea por producto, con el precio y el nombre como snapshot.
      const items = [...quantities].map(([productId, quantity]) => {
        const product = productById.get(productId)!;
        const unitPrice = new Prisma.Decimal(product.price);
        const subtotal = unitPrice.mul(quantity);

        return {
          productId,
          productName: product.name,
          unitPrice,
          quantity,
          subtotal,
        };
      });

      const total = items.reduce(
        (sum, item) => sum.add(item.subtotal),
        new Prisma.Decimal(0),
      );

      // Base imponible e IGV con el mismo redondeo por línea que se envía a
      // Nubefact, para que la venta guardada cuadre con el comprobante.
      const amounts = buildNubefactItems(
        items.map((item) => ({
          description: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      );

      // El comprobante se reserva en la misma transacción que la venta.
      const identity = resolveInvoiceIdentity(customer);
      const counter = await tx.invoiceCounter.upsert({
        where: { series: identity.series },
        create: {
          series: identity.series,
          nextNumber: identity.initialNumber + 1,
        },
        update: { nextNumber: { increment: 1 } },
        select: { nextNumber: true },
      });
      const invoiceNumber = counter.nextNumber - 1;

      return tx.sale.create({
        data: {
          customerId: data.customerId,
          taxableAmount: amounts.totalGravada,
          igvAmount: amounts.totalIgv,
          total,
          items: { create: items },
          invoice: {
            create: {
              documentType: identity.documentType,
              invoiceType: identity.invoiceType,
              series: identity.series,
              number: invoiceNumber,
              status: "PENDIENTE",
            },
          },
        },
        include: SALE_INCLUDE,
      });
    });

    // Si Nubefact falla, la venta queda igual con el comprobante PENDIENTE.
    const { sale: saleWithInvoice } = await emitSaleInvoice(sale);

    return Response.json({ data: saleWithInvoice }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
