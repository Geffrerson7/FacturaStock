import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Comprobación optimista: solo mira si existe la cookie de sesión, sin
 * consultar la base. La validación real está en `requireSession` (cada Route
 * Handler) y en `getCurrentUser` (layout del panel).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Debes iniciar sesión para continuar.",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  // Todo /admin y todo /api, salvo la autenticación y el endpoint de salud.
  matcher: ["/admin/:path*", "/api/((?!auth/|health/).*)"],
};
