import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Los handlers deben rechazar la petición antes de tocar la base, así que
// Prisma se sustituye por un objeto que falla si alguien lo usa.
vi.mock("@/src/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(`prisma.${String(property)} was used without a session`);
      },
    },
  ),
}));

const getSession = vi.hoisted(() => vi.fn());
const signInEmail = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/auth", () => ({
  auth: { api: { getSession, signInEmail } },
}));

const lookupDni = vi.hoisted(() => vi.fn());
const lookupRuc = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/decolecta", () => ({ lookupDni, lookupRuc }));

import * as demoRoute from "@/app/api/auth/demo/route";
import * as categoryRoute from "@/app/api/categorias/[id]/route";
import * as categoriesRoute from "@/app/api/categorias/route";
import * as customerRoute from "@/app/api/clientes/[id]/route";
import * as customersRoute from "@/app/api/clientes/route";
import * as signatureRoute from "@/app/api/cloudinary/signature/route";
import * as dniRoute from "@/app/api/consulta/dni/route";
import * as rucRoute from "@/app/api/consulta/ruc/route";
import * as productRoute from "@/app/api/productos/[id]/route";
import * as productsRoute from "@/app/api/productos/route";
import * as cancelSaleRoute from "@/app/api/ventas/[id]/anular/route";
import * as invoiceRoute from "@/app/api/ventas/[id]/comprobante/route";
import * as salesRoute from "@/app/api/ventas/route";
import { config as proxyConfig, proxy } from "@/proxy";
import {
  canUseMethod,
  isAllowedAuthRoute,
} from "@/src/lib/auth-policy";
import {
  PRODUCT_IMAGE_FOLDER,
  signProductImageUpload,
} from "@/src/lib/cloudinary";
import { createRateLimiter } from "@/src/lib/rate-limit";

type Handler = (request: Request, ctx: never) => Promise<Response>;

type Endpoint = {
  method: string;
  path: string;
  handler: Handler;
};

const ID = "3f0c1a52-6f0e-4d0a-9d3b-0a4f5b8f7c11";

function endpoint(method: string, path: string, module: object): Endpoint {
  const handler = (module as Record<string, Handler | undefined>)[method];

  if (!handler) throw new Error(`${method} ${path} is not exported`);

  return { method, path, handler };
}

// Todos los endpoints protegidos de la API.
const ENDPOINTS: Endpoint[] = [
  endpoint("GET", "/api/categorias", categoriesRoute),
  endpoint("POST", "/api/categorias", categoriesRoute),
  endpoint("PUT", `/api/categorias/${ID}`, categoryRoute),
  endpoint("DELETE", `/api/categorias/${ID}`, categoryRoute),
  endpoint("GET", "/api/clientes", customersRoute),
  endpoint("POST", "/api/clientes", customersRoute),
  endpoint("PUT", `/api/clientes/${ID}`, customerRoute),
  endpoint("DELETE", `/api/clientes/${ID}`, customerRoute),
  endpoint("GET", "/api/productos", productsRoute),
  endpoint("POST", "/api/productos", productsRoute),
  endpoint("PUT", `/api/productos/${ID}`, productRoute),
  endpoint("DELETE", `/api/productos/${ID}`, productRoute),
  endpoint("GET", "/api/ventas", salesRoute),
  endpoint("POST", "/api/ventas", salesRoute),
  endpoint("POST", `/api/ventas/${ID}/anular`, cancelSaleRoute),
  endpoint("POST", `/api/ventas/${ID}/comprobante`, invoiceRoute),
  endpoint("POST", "/api/cloudinary/signature", signatureRoute),
  endpoint("GET", "/api/consulta/dni?numero=46027897", dniRoute),
  endpoint("GET", "/api/consulta/ruc?numero=20601030013", rucRoute),
];

const WRITE_ENDPOINTS = ENDPOINTS.filter(({ method }) => method !== "GET");

function call({ method, path, handler }: Endpoint) {
  const request = new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });

  return handler(request, { params: Promise.resolve({ id: ID }) } as never);
}

function sessionFor(role: "ADMIN" | "DEMO") {
  return {
    session: { id: "session-1" },
    user: { id: `user-${role}`, name: role, email: `${role}@test.dev`, role },
  };
}

beforeEach(() => {
  getSession.mockReset();
  signInEmail.mockReset();
  lookupDni.mockReset();
  lookupRuc.mockReset();
  vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
});

describe("endpoints protegidos sin sesión", () => {
  it.each(ENDPOINTS)("$method $path responde 401", async (target) => {
    getSession.mockResolvedValue(null);

    const response = await call(target);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("usuario de demostración", () => {
  it.each(WRITE_ENDPOINTS)("$method $path responde 403", async (target) => {
    getSession.mockResolvedValue(sessionFor("DEMO"));

    const response = await call(target);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("DEMO_READ_ONLY");
  });

  it("no puede gastar consultas de DNI ni RUC aunque sean GET", async () => {
    getSession.mockResolvedValue(sessionFor("DEMO"));

    for (const target of ENDPOINTS.filter(({ path }) =>
      path.startsWith("/api/consulta/"),
    )) {
      const response = await call(target);

      expect(response.status).toBe(403);
    }

    expect(lookupDni).not.toHaveBeenCalled();
    expect(lookupRuc).not.toHaveBeenCalled();
  });

  it("pasa la comprobación de sesión en los listados (GET)", async () => {
    getSession.mockResolvedValue(sessionFor("DEMO"));

    // El handler sigue hasta la base (aquí simulada para fallar), en lugar de
    // devolver 401 o 403.
    const response = await call(endpoint("GET", "/api/productos", productsRoute));

    expect(response.status).toBe(500);
  });
});

describe("canUseMethod", () => {
  it("limita al usuario de demostración a lecturas", () => {
    expect(canUseMethod("DEMO", "GET")).toBe(true);
    expect(canUseMethod("DEMO", "HEAD")).toBe(true);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(canUseMethod("DEMO", method)).toBe(false);
      expect(canUseMethod("ADMIN", method)).toBe(true);
    }
  });
});

describe("consultas de DNI y RUC", () => {
  it("responde 429 al superar el límite por usuario", async () => {
    getSession.mockResolvedValue({
      ...sessionFor("ADMIN"),
      user: { ...sessionFor("ADMIN").user, id: "user-rate-limited" },
    });
    lookupDni.mockResolvedValue({ documentType: "DNI" });

    const target = endpoint("GET", "/api/consulta/dni?numero=46027897", dniRoute);
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push((await call(target)).status);
    }

    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(lookupDni).toHaveBeenCalledTimes(10);
  });
});

describe("createRateLimiter", () => {
  it("bloquea al pasar el límite y se reinicia al terminar la ventana", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 10).allowed).toBe(true);
    expect(check("a", 20)).toMatchObject({ allowed: false, retryAfter: 1 });
    expect(check("b", 20).allowed).toBe(true);
    expect(check("a", 1_000).allowed).toBe(true);
  });
});

describe("firma de Cloudinary", () => {
  it("firma solo la carpeta fija y el timestamp del servidor", async () => {
    getSession.mockResolvedValue(sessionFor("ADMIN"));

    const request = new Request("http://localhost:3000/api/cloudinary/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Parámetros que un atacante querría firmar: se ignoran.
      body: JSON.stringify({
        paramsToSign: { folder: "otra/carpeta", public_id: "x", overwrite: true },
      }),
    });

    const response = await signatureRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.folder).toBe(PRODUCT_IMAGE_FOLDER);
    expect(body).toEqual(signProductImageUpload("test-secret", body.timestamp));
    expect(Object.keys(body).sort()).toEqual(["folder", "signature", "timestamp"]);
  });
});

describe("inicio de sesión de demostración", () => {
  const request = () =>
    new Request("http://localhost:3000/api/auth/demo", { method: "POST" });

  it("responde 404 si no hay credenciales en el entorno", async () => {
    vi.stubEnv("DEMO_USER_EMAIL", "");
    vi.stubEnv("DEMO_USER_PASSWORD", "");

    const response = await demoRoute.POST(request());

    expect(response.status).toBe(404);
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("usa las credenciales del entorno y solo devuelve la cookie", async () => {
    vi.stubEnv("DEMO_USER_EMAIL", "Demo@Test.dev");
    vi.stubEnv("DEMO_USER_PASSWORD", "secret-password");

    const upstream = new Headers({ "Content-Type": "application/json" });
    upstream.append("Set-Cookie", "better-auth.session_token=abc; Path=/");
    signInEmail.mockResolvedValue(
      new Response(JSON.stringify({ user: { email: "demo@test.dev" } }), {
        status: 200,
        headers: upstream,
      }),
    );

    const response = await demoRoute.POST(request());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(signInEmail.mock.calls[0][0].body).toEqual({
      email: "demo@test.dev",
      password: "secret-password",
    });
    expect(response.headers.getSetCookie()).toEqual([
      "better-auth.session_token=abc; Path=/",
    ]);
    expect(text).toBe(JSON.stringify({ ok: true }));
  });

  it("responde 500 sin detalles si el inicio de sesión falla", async () => {
    vi.stubEnv("DEMO_USER_EMAIL", "demo@test.dev");
    vi.stubEnv("DEMO_USER_PASSWORD", "secret-password");
    signInEmail.mockRejectedValue(new Error("Invalid email or password"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await demoRoute.POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("DEMO_SIGN_IN_FAILED");
    expect(JSON.stringify(body)).not.toContain("secret-password");
  });
});

describe("isAllowedAuthRoute", () => {
  it("solo expone inicio de sesión, registro, cierre y lectura de sesión", () => {
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-in/email")).toBe(true);
    expect(isAllowedAuthRoute("POST", "/api/auth/sign-out")).toBe(true);
    expect(isAllowedAuthRoute("GET", "/api/auth/get-session")).toBe(true);

    expect(isAllowedAuthRoute("POST", "/api/auth/change-password")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth/update-user")).toBe(false);
    expect(isAllowedAuthRoute("POST", "/api/auth/delete-user")).toBe(false);
    expect(isAllowedAuthRoute("GET", "/api/auth/sign-out")).toBe(false);
  });
});

describe("proxy", () => {
  it("responde 401 en /api sin cookie de sesión", async () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/ventas"));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("redirige /admin al login sin cookie de sesión", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/admin/dashboard"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("deja pasar la petición cuando hay cookie de sesión", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/api/ventas", {
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("no cubre la autenticación ni el endpoint de salud", () => {
    expect(proxyConfig.matcher).toEqual([
      "/admin/:path*",
      "/api/((?!auth/|health/).*)",
    ]);
  });
});
