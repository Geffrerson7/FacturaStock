import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prisma se sustituye por funciones simuladas: cada test decide qué devuelve
// la base y comprueba qué se le pidió.
const db = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  });

  return {
    sale: model(),
    product: model(),
    customer: model(),
    category: model(),
    invoice: model(),
    invoiceCounter: model(),
    $transaction: vi.fn(),
  };
});

vi.mock("@/src/lib/prisma", () => ({ prisma: db }));

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/auth", () => ({ auth: { api: { getSession } } }));

import * as categoriesRoute from "@/app/api/categorias/route";
import * as customerRoute from "@/app/api/clientes/[id]/route";
import * as customersRoute from "@/app/api/clientes/route";
import * as productRoute from "@/app/api/productos/[id]/route";
import * as productsRoute from "@/app/api/productos/route";
import * as cancellationRoute from "@/app/api/ventas/[id]/anulacion/route";
import * as cancelSaleRoute from "@/app/api/ventas/[id]/anular/route";
import * as salesRoute from "@/app/api/ventas/route";
import { Prisma } from "@/src/generated/prisma/client";
import { buildCategoryOrderBy } from "@/src/lib/api/category";
import {
  buildCustomerOrderBy,
  buildCustomerWhere,
  NOT_WALK_IN,
} from "@/src/lib/api/customer-data";
import { ApiError, handleApiError } from "@/src/lib/api/errors";
import { buildProductWhere } from "@/src/lib/api/product";
import { buildSaleWhere } from "@/src/lib/api/sale";
import { isManagedProductImage } from "@/src/lib/cloudinary";
import {
  getInvoiceSeries,
  NubefactError,
  resolveInvoiceIdentity,
} from "@/src/lib/nubefact";
import { createCustomerSchema } from "@/src/lib/validations/customer";

const SALE_ID = "3f0c1a52-6f0e-4d0a-9d3b-0a4f5b8f7c11";
const PRODUCT_ID = "9b2e4d7a-1c3f-4a5b-8d6e-2f1a0b9c8d7e";
const CUSTOMER_ID = "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f";
const CATEGORY_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const INVOICE_ID = "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f";

type Handler = (request: Request, ctx: never) => Promise<Response>;

function call(
  handler: Handler,
  method: string,
  path: string,
  { body, id }: { body?: unknown; id?: string } = {},
) {
  const request = new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return handler(request, { params: Promise.resolve({ id }) } as never);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);

  getSession.mockResolvedValue({
    session: { id: "session-1" },
    user: { id: "user-1", name: "Admin", email: "admin@test.dev", role: "ADMIN" },
  });

  // Como en Prisma: una función recibe el cliente de la transacción y una
  // lista de consultas se resuelve en orden.
  db.$transaction.mockImplementation((argument: unknown) =>
    typeof argument === "function"
      ? (argument as (tx: typeof db) => unknown)(db)
      : Promise.all(argument as Promise<unknown>[]),
  );

  vi.stubEnv("NUBEFACT_API_URL", "https://nubefact.test/api");
  vi.stubEnv("NUBEFACT_API_TOKEN", "token");
  vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "demo-cloud");
  vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_API_KEY", "123456");
  vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// N1: anulación
// ---------------------------------------------------------------------------

describe("anulación de una venta (N1)", () => {
  /** Base en memoria con una venta de 3 unidades de un producto. */
  function setupSale(invoiceStatus: "EMITIDO" | "PENDIENTE") {
    const state = {
      saleStatus: "COMPLETADA",
      invoiceStatus: invoiceStatus as string,
      stock: 7,
    };

    const snapshot = () => ({
      id: SALE_ID,
      number: 12,
      status: state.saleStatus,
      customer: null,
      items: [{ id: "item-1", productId: PRODUCT_ID, quantity: 3 }],
      invoice: {
        id: INVOICE_ID,
        status: state.invoiceStatus,
        invoiceType: 2,
        series: "BBB1",
        number: 6,
      },
    });

    db.sale.findUnique.mockImplementation(async () => snapshot());
    db.sale.findUniqueOrThrow.mockImplementation(async () => snapshot());
    // Actualización condicional, como el UPDATE ... WHERE status = 'COMPLETADA'.
    db.sale.updateMany.mockImplementation(async ({ where, data }) => {
      if (state.saleStatus !== where.status) return { count: 0 };

      state.saleStatus = data.status;
      return { count: 1 };
    });
    db.product.updateMany.mockImplementation(async ({ data }) => {
      state.stock += data.stock.increment;
      return { count: 1 };
    });
    db.invoice.update.mockImplementation(async ({ data }) => {
      state.invoiceStatus = data.status;
      return {};
    });

    return state;
  }

  const cancel = () =>
    call(cancelSaleRoute.POST, "POST", `/api/ventas/${SALE_ID}/anular`, {
      id: SALE_ID,
    });

  it("repone el stock y marca la venta como anulada", async () => {
    const state = setupSale("PENDIENTE");

    const response = await cancel();

    expect(response.status).toBe(200);
    expect(state).toEqual({
      saleStatus: "ANULADA",
      invoiceStatus: "ANULADO",
      stock: 10,
    });
    // Un comprobante pendiente nunca llegó a SUNAT: no se llama a Nubefact.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dos anulaciones simultáneas reponen el stock una sola vez", async () => {
    const state = setupSale("EMITIDO");

    // Nubefact no responde hasta que las dos peticiones lo han llamado: así
    // ambas leyeron la venta como COMPLETADA antes de abrir su transacción.
    let pending = 0;
    let release!: () => void;
    const bothWaiting = new Promise<void>((resolve) => {
      release = resolve;
    });

    fetchMock.mockImplementation(async () => {
      pending += 1;
      if (pending === 2) release();
      await bothWaiting;

      return jsonResponse({ aceptada_por_sunat: true });
    });

    const responses = await Promise.all([cancel(), cancel()]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect(db.sale.findUnique).toHaveBeenCalledTimes(2);
    expect(db.product.updateMany).toHaveBeenCalledTimes(1);
    expect(state.stock).toBe(10);
    expect(state.saleStatus).toBe("ANULADA");

    const rejected = responses.find((response) => response.status === 409)!;
    const body = await rejected.json();

    expect(body.error.code).toBe("SALE_ALREADY_CANCELLED");
    expect(body.error.message).toBe("La venta ya fue anulada.");
  });

  it("no anula la venta si Nubefact rechaza la anulación", async () => {
    const state = setupSale("EMITIDO");
    fetchMock.mockResolvedValue(
      jsonResponse({ errors: "El documento no existe", codigo: 24 }, 400),
    );

    const response = await cancel();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("NUBEFACT_ERROR");
    expect(body.error.message).toContain("El documento no existe");
    expect(state).toMatchObject({ saleStatus: "COMPLETADA", stock: 7 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// N2 y N3: búsqueda, filtros y orden
// ---------------------------------------------------------------------------

describe("búsqueda, filtros y orden en los listados (N2, N3)", () => {
  it("el buscador de productos de la venta filtra y limita en el servidor", async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    const response = await call(
      productsRoute.GET,
      "GET",
      `/api/productos?q=agua+500&isActive=true&categoryId=${CATEGORY_ID}&sort=name&order=asc&pageSize=8`,
    );

    expect(response.status).toBe(200);

    const where = {
      AND: [
        { categoryId: CATEGORY_ID },
        { isActive: true },
        {
          OR: [
            { name: { contains: "agua", mode: "insensitive" } },
            { sku: { contains: "agua", mode: "insensitive" } },
          ],
        },
        {
          OR: [
            { name: { contains: "500", mode: "insensitive" } },
            { sku: { contains: "500", mode: "insensitive" } },
          ],
        },
      ],
    };

    expect(db.product.findMany).toHaveBeenCalledWith({
      where,
      include: { category: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 0,
      take: 8,
    });
    // El total cuenta con el mismo filtro, no toda la tabla.
    expect(db.product.count).toHaveBeenCalledWith({ where });
  });

  it("sin parámetros conserva el listado de siempre", async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    await call(productsRoute.GET, "GET", "/api/productos");

    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [] },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    );
    expect(buildProductWhere({ q: "  ", isActive: false })).toEqual({
      AND: [{ isActive: false }],
    });
  });

  it.each([
    ["/api/productos?sort=password", productsRoute.GET],
    ["/api/productos?isActive=quizas", productsRoute.GET],
    ["/api/productos?categoryId=abc", productsRoute.GET],
    ["/api/clientes?documentType=CE", customersRoute.GET],
    ["/api/categorias?order=arriba", categoriesRoute.GET],
    ["/api/ventas?status=BORRADA", salesRoute.GET],
    ["/api/ventas?from=14/11/2026", salesRoute.GET],
    ["/api/ventas?from=2026-11-14&to=2026-11-01", salesRoute.GET],
  ])("%s responde 400 sin consultar la base", async (path, handler) => {
    const response = await call(handler as Handler, "GET", path);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("busca clientes por nombre o documento y filtra por tipo", async () => {
    db.customer.findMany.mockResolvedValue([]);
    db.customer.count.mockResolvedValue(0);

    await call(
      customersRoute.GET,
      "GET",
      "/api/clientes?q=ana&documentType=DNI&sort=name&order=asc",
    );

    const { where, orderBy } = db.customer.findMany.mock.calls[0][0];

    expect(where.AND).toContainEqual({ documentType: "DNI" });
    expect(where.AND).toContainEqual({
      OR: [
        { firstName: { contains: "ana", mode: "insensitive" } },
        { lastName: { contains: "ana", mode: "insensitive" } },
        { businessName: { contains: "ana", mode: "insensitive" } },
        { dni: { contains: "ana", mode: "insensitive" } },
        { ruc: { contains: "ana", mode: "insensitive" } },
        { email: { contains: "ana", mode: "insensitive" } },
      ],
    });
    expect(orderBy).toEqual(buildCustomerOrderBy({ sort: "name", order: "asc" }));
    expect(orderBy[0]).toEqual({ lastName: { sort: "asc", nulls: "last" } });
  });

  it("ordena las categorías por nombre o por cantidad de productos", async () => {
    db.category.findMany.mockResolvedValue([]);
    db.category.count.mockResolvedValue(0);

    await call(
      categoriesRoute.GET,
      "GET",
      "/api/categorias?q=beb&sort=productCount&order=desc",
    );

    expect(db.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: "beb", mode: "insensitive" } },
                { description: { contains: "beb", mode: "insensitive" } },
              ],
            },
          ],
        },
        orderBy: [{ products: { _count: "desc" } }, { id: "desc" }],
      }),
    );
    expect(buildCategoryOrderBy({ sort: "name", order: "asc" })).toEqual([
      { name: "asc" },
      { id: "asc" },
    ]);
  });

  it("filtra las ventas por estado, comprobante y fechas de Lima", async () => {
    db.sale.findMany.mockResolvedValue([]);
    db.sale.count.mockResolvedValue(0);

    await call(
      salesRoute.GET,
      "GET",
      "/api/ventas?status=ANULADA&invoiceStatus=ANULACION_PENDIENTE&from=2026-11-01&to=2026-11-14&sort=total&order=asc",
    );

    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { status: "ANULADA" },
            { invoice: { is: { status: "ANULACION_PENDIENTE" } } },
            // Medianoche en Lima son las 05:00 UTC.
            { createdAt: { gte: new Date("2026-11-01T05:00:00.000Z") } },
            // La fecha final es inclusiva: hasta el final del día 14.
            { createdAt: { lt: new Date("2026-11-15T05:00:00.000Z") } },
          ],
        },
        orderBy: [{ total: "asc" }, { number: "asc" }],
      }),
    );
  });

  it("busca ventas por número, comprobante, cliente o producto", () => {
    const [byNumber] = buildSaleWhere({ q: "12" }).AND as Prisma.SaleWhereInput[];
    const [byText] = buildSaleWhere({ q: "agua" }).AND as Prisma.SaleWhereInput[];

    expect(byNumber.OR).toContainEqual({ number: 12 });
    expect(byNumber.OR).toContainEqual({ invoice: { is: { number: 12 } } });
    // Un texto no se compara con las columnas numéricas.
    expect(byText.OR).not.toContainEqual({ number: Number.NaN });
    expect(byText.OR).toContainEqual({
      items: {
        some: { productName: { contains: "agua", mode: "insensitive" } },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// N4: anulación pendiente
// ---------------------------------------------------------------------------

describe("estado de una anulación pendiente (N4)", () => {
  function pendingSale(invoiceStatus = "ANULACION_PENDIENTE") {
    return {
      id: SALE_ID,
      status: "ANULADA",
      invoice: {
        id: INVOICE_ID,
        status: invoiceStatus,
        invoiceType: 1,
        series: "FFF1",
        number: 8,
      },
    };
  }

  const refresh = () =>
    call(cancellationRoute.POST, "POST", `/api/ventas/${SALE_ID}/anulacion`, {
      id: SALE_ID,
    });

  it("marca el comprobante como anulado cuando SUNAT acepta la baja", async () => {
    db.sale.findUnique.mockResolvedValue(pendingSale());
    db.sale.findUniqueOrThrow.mockResolvedValue(pendingSale("ANULADO"));
    db.invoice.updateMany.mockResolvedValue({ count: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({
        numero: 8,
        aceptada_por_sunat: true,
        sunat_description: "La Comunicación de baja ha sido aceptada",
        enlace_del_cdr: "https://nubefact.test/anulacion/x.cdr",
      }),
    );

    const response = await refresh();

    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      operacion: "consultar_anulacion",
      tipo_de_comprobante: 1,
      serie: "FFF1",
      numero: 8,
    });
    expect(db.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: INVOICE_ID, status: "ANULACION_PENDIENTE" },
      data: expect.objectContaining({
        status: "ANULADO",
        sunatAccepted: true,
        sunatDescription: "La Comunicación de baja ha sido aceptada",
        cdrUrl: "https://nubefact.test/anulacion/x.cdr",
      }),
    });
  });

  it("lo deja pendiente mientras SUNAT no responde", async () => {
    db.sale.findUnique.mockResolvedValue(pendingSale());
    db.sale.findUniqueOrThrow.mockResolvedValue(pendingSale());
    db.invoice.updateMany.mockResolvedValue({ count: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({ numero: 8, aceptada_por_sunat: false }),
    );

    const response = await refresh();

    expect(response.status).toBe(200);
    expect(db.invoice.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "ANULACION_PENDIENTE",
      sunatAccepted: false,
    });
  });

  it("responde 409 sin llamar a Nubefact si no hay anulación pendiente", async () => {
    db.sale.findUnique.mockResolvedValue(pendingSale("ANULADO"));

    const response = await refresh();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CANCELLATION_NOT_PENDING");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// N5: mensajes en español
// ---------------------------------------------------------------------------

describe("mensajes de error en español (N5)", () => {
  it("explica la falta de stock al registrar una venta", async () => {
    db.product.findMany.mockResolvedValue([
      {
        id: PRODUCT_ID,
        name: "Agua mineral 500 ml",
        price: "2.50",
        stock: 2,
        isActive: true,
      },
    ]);

    const response = await call(salesRoute.POST, "POST", "/api/ventas", {
      body: { customerId: null, items: [{ productId: PRODUCT_ID, quantity: 5 }] },
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(body.error.message).toBe(
      'No hay stock suficiente de "Agua mineral 500 ml". Disponible: 2, solicitado: 5.',
    );
  });

  it("describe los errores de validación campo por campo", async () => {
    const response = await call(customersRoute.POST, "POST", "/api/clientes", {
      body: { documentType: "DNI", dni: "12", firstName: "", lastName: "Pérez" },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe("Los datos enviados no son válidos.");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        { path: "dni", message: "El DNI debe tener exactamente 8 dígitos." },
        { path: "firstName", message: "El nombre es obligatorio." },
        { path: "address", message: "La dirección es obligatoria." },
      ]),
    );
  });

  it("nombra el campo duplicado en los conflictos", async () => {
    const duplicated = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: { target: ["sku"] } },
    );

    const response = handleApiError(duplicated, {
      code: "PRODUCT_ALREADY_EXISTS",
      entity: "un producto",
      fields: ["sku"],
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toEqual({
      code: "PRODUCT_ALREADY_EXISTS",
      message: "Ya existe un producto con ese SKU.",
      field: "sku",
    });
  });

  it("no expone el detalle de un error inesperado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleApiError(new Error("connection refused 10.0.0.5"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).toBe(
      "Ocurrió un error inesperado. Inténtalo de nuevo.",
    );
  });

  it("devuelve los errores de Nubefact como 502", async () => {
    const response = handleApiError(new NubefactError("Token inválido"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("NUBEFACT_ERROR");
  });
});

// ---------------------------------------------------------------------------
// N6: series por entorno
// ---------------------------------------------------------------------------

describe("series y correlativos desde el entorno (N6)", () => {
  it("usa los valores de la cuenta de demostración por defecto", () => {
    expect(getInvoiceSeries()).toEqual({
      FACTURA: { series: "FFF1", invoiceType: 1, initialNumber: 8 },
      BOLETA: { series: "BBB1", invoiceType: 2, initialNumber: 6 },
    });
  });

  it("lee las series y los números iniciales de las variables", () => {
    vi.stubEnv("NUBEFACT_FACTURA_SERIES", "f001");
    vi.stubEnv("NUBEFACT_FACTURA_INITIAL_NUMBER", "1");
    vi.stubEnv("NUBEFACT_BOLETA_SERIES", "B002");
    vi.stubEnv("NUBEFACT_BOLETA_INITIAL_NUMBER", "250");

    expect(getInvoiceSeries()).toEqual({
      FACTURA: { series: "F001", invoiceType: 1, initialNumber: 1 },
      BOLETA: { series: "B002", invoiceType: 2, initialNumber: 250 },
    });
    expect(resolveInvoiceIdentity(null)).toMatchObject({
      documentType: "BOLETA",
      series: "B002",
      initialNumber: 250,
    });
  });

  it.each([
    ["NUBEFACT_FACTURA_SERIES", "B001"],
    ["NUBEFACT_BOLETA_SERIES", "BOLETA1"],
    ["NUBEFACT_BOLETA_INITIAL_NUMBER", "0"],
    ["NUBEFACT_FACTURA_INITIAL_NUMBER", "ocho"],
  ])("rechaza %s=%s", (variable, value) => {
    vi.stubEnv(variable, value);

    expect(() => getInvoiceSeries()).toThrowError(ApiError);
    expect(() => getInvoiceSeries()).toThrowError(variable);
  });

  it("reserva el primer comprobante de una serie nueva con su número inicial", async () => {
    vi.stubEnv("NUBEFACT_BOLETA_SERIES", "B002");
    vi.stubEnv("NUBEFACT_BOLETA_INITIAL_NUMBER", "250");
    mockSaleCreation();

    await call(salesRoute.POST, "POST", "/api/ventas", {
      body: { customerId: null, items: [{ productId: PRODUCT_ID, quantity: 3 }] },
    });

    expect(db.invoiceCounter.upsert).toHaveBeenCalledWith({
      where: { series: "B002" },
      create: { series: "B002", nextNumber: 251 },
      update: { nextNumber: { increment: 1 } },
      select: { nextNumber: true },
    });
    expect(db.sale.create.mock.calls[0][0].data.invoice.create).toMatchObject({
      series: "B002",
      number: 250,
    });
  });
});

/** Simula la base para registrar una venta de un producto de S/ 9.99. */
function mockSaleCreation() {
  db.product.findMany.mockResolvedValue([
    {
      id: PRODUCT_ID,
      name: "Detergente 1 kg",
      price: "9.99",
      stock: 50,
      isActive: true,
    },
  ]);
  db.product.updateMany.mockResolvedValue({ count: 1 });
  db.invoiceCounter.upsert.mockImplementation(async ({ create }) => ({
    nextNumber: create.nextNumber,
  }));
  // Sin comprobante, la emisión en Nubefact se omite.
  db.sale.create.mockResolvedValue({ id: SALE_ID, invoice: null });
}

// ---------------------------------------------------------------------------
// N7: imágenes en Cloudinary
// ---------------------------------------------------------------------------

describe("imágenes huérfanas en Cloudinary (N7)", () => {
  const OLD_IMAGE = "facturastock/products/vieja";
  const NEW_IMAGE = "facturastock/products/nueva";

  function productBody(imagePublicId: string | null) {
    return {
      name: "Agua mineral 500 ml",
      sku: "BEB-001",
      price: 2.5,
      stock: 10,
      categoryId: CATEGORY_ID,
      imageUrl: imagePublicId ? `https://res.cloudinary.com/${imagePublicId}` : null,
      imagePublicId,
    };
  }

  function update(previous: string | null, next: string | null) {
    db.category.findUnique.mockResolvedValue({ id: CATEGORY_ID });
    db.product.findUnique.mockResolvedValue({ imagePublicId: previous });
    db.product.update.mockResolvedValue({ id: PRODUCT_ID, imagePublicId: next });

    return call(productRoute.PUT, "PUT", `/api/productos/${PRODUCT_ID}`, {
      id: PRODUCT_ID,
      body: productBody(next),
    });
  }

  function destroyedPublicIds() {
    return fetchMock.mock.calls.map(([url, init]) => {
      expect(url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/destroy");

      return (init.body as URLSearchParams).get("public_id");
    });
  }

  beforeEach(() => {
    db.product.count.mockResolvedValue(0);
    fetchMock.mockResolvedValue(jsonResponse({ result: "ok" }));
  });

  it("borra la imagen anterior al reemplazarla", async () => {
    const response = await update(OLD_IMAGE, NEW_IMAGE);

    expect(response.status).toBe(200);
    expect(destroyedPublicIds()).toEqual([OLD_IMAGE]);

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;

    expect(body.get("api_key")).toBe("123456");
    expect(body.get("signature")).toMatch(/^[0-9a-f]{40}$/);
    // El secreto firma la petición, pero nunca viaja en ella.
    expect(body.toString()).not.toContain("test-secret");
  });

  it("borra la imagen al quitarla del producto", async () => {
    await update(OLD_IMAGE, null);

    expect(destroyedPublicIds()).toEqual([OLD_IMAGE]);
  });

  it("no borra nada si la imagen no cambió", async () => {
    await update(OLD_IMAGE, OLD_IMAGE);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("borra la imagen al eliminar el producto", async () => {
    db.product.delete.mockResolvedValue({ imagePublicId: OLD_IMAGE });

    const response = await call(
      productRoute.DELETE,
      "DELETE",
      `/api/productos/${PRODUCT_ID}`,
      { id: PRODUCT_ID },
    );

    expect(response.status).toBe(204);
    expect(destroyedPublicIds()).toEqual([OLD_IMAGE]);
  });

  it("conserva la imagen si otro producto todavía la usa", async () => {
    db.product.count.mockResolvedValue(1);

    await update(OLD_IMAGE, NEW_IMAGE);

    expect(db.product.count).toHaveBeenCalledWith({
      where: { imagePublicId: OLD_IMAGE },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nunca borra archivos fuera de la carpeta de productos", async () => {
    // El public_id lo envía el navegador: no se confía en él.
    await update("otra-carpeta/logo", NEW_IMAGE);
    await update("facturastock/products/../../logo", NEW_IMAGE);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(isManagedProductImage("facturastock/products/abc")).toBe(true);
    expect(isManagedProductImage("facturastock/productsX/abc")).toBe(false);
  });

  it("guarda el producto aunque Cloudinary falle", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("network down"));

    const response = await update(OLD_IMAGE, NEW_IMAGE);

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// N8: cliente walk-in
// ---------------------------------------------------------------------------

describe("cliente walk-in (N8)", () => {
  it("no aparece en el listado ni en el buscador de clientes", async () => {
    db.customer.findMany.mockResolvedValue([]);
    db.customer.count.mockResolvedValue(0);

    await call(customersRoute.GET, "GET", "/api/clientes");

    const where = { AND: [NOT_WALK_IN] };

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(db.customer.count).toHaveBeenCalledWith({ where });
    // Las empresas no tienen DNI: el filtro debe conservarlas.
    expect(NOT_WALK_IN).toEqual({
      OR: [{ dni: null }, { dni: { not: "00000000" } }],
    });
    expect(buildCustomerWhere({ q: "00000000" }).AND).toContainEqual(NOT_WALK_IN);
  });

  it.each(["PUT", "DELETE"] as const)("%s responde 403", async (method) => {
    db.customer.findUnique.mockResolvedValue({ dni: "00000000" });

    const response = await call(
      customerRoute[method],
      method,
      `/api/clientes/${CUSTOMER_ID}`,
      {
        id: CUSTOMER_ID,
        body: {
          documentType: "DNI",
          dni: "46027897",
          firstName: "Ana",
          lastName: "Pérez",
          address: "Av. Lima 123",
        },
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("WALK_IN_CUSTOMER_PROTECTED");
    expect(db.customer.update).not.toHaveBeenCalled();
    expect(db.customer.delete).not.toHaveBeenCalled();
  });

  it("los demás clientes se siguen pudiendo eliminar", async () => {
    db.customer.findUnique.mockResolvedValue({ dni: "46027897" });
    db.customer.delete.mockResolvedValue({});

    const response = await call(
      customerRoute.DELETE,
      "DELETE",
      `/api/clientes/${CUSTOMER_ID}`,
      { id: CUSTOMER_ID },
    );

    expect(response.status).toBe(204);
  });

  it("no se puede registrar otro cliente con el DNI reservado", () => {
    const result = createCustomerSchema.safeParse({
      documentType: "DNI",
      dni: "00000000",
      firstName: "Ana",
      lastName: "Pérez",
      address: "Av. Lima 123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["dni"],
      message: "Ese DNI está reservado.",
    });
  });
});

// ---------------------------------------------------------------------------
// N9: base imponible e IGV
// ---------------------------------------------------------------------------

describe("desglose de la venta (N9)", () => {
  it("guarda la base imponible y el IGV junto al total", async () => {
    mockSaleCreation();

    const response = await call(salesRoute.POST, "POST", "/api/ventas", {
      body: { customerId: null, items: [{ productId: PRODUCT_ID, quantity: 3 }] },
    });

    expect(response.status).toBe(201);

    const { taxableAmount, igvAmount, total } =
      db.sale.create.mock.calls[0][0].data;

    // 9.99 / 1.18 = 8.47 por unidad; 3 unidades.
    expect(taxableAmount).toBe(25.41);
    expect(igvAmount).toBe(4.56);
    expect(total.toFixed(2)).toBe("29.97");
    // En céntimos, para no depender de la suma en coma flotante.
    expect(Math.round(taxableAmount * 100) + Math.round(igvAmount * 100)).toBe(
      2997,
    );
  });
});
