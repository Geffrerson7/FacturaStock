import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/src/lib/auth";
import { isAllowedAuthRoute } from "@/src/lib/auth-policy";

const handlers = toNextJsHandler(auth);

function guard(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const { pathname } = new URL(request.url);

    // Solo se exponen inicio de sesión, registro, cierre y lectura de sesión.
    if (!isAllowedAuthRoute(request.method, pathname)) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Ruta no disponible." } },
        { status: 404 },
      );
    }

    return handler(request);
  };
}

export const GET = guard(handlers.GET);
export const POST = guard(handlers.POST);
