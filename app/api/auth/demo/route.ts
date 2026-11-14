import { auth } from "@/src/lib/auth";
import { getDemoCredentials } from "@/src/lib/demo";

/**
 * Inicia sesión con el usuario de demostración.
 *
 * POST /api/auth/demo
 *
 * Las credenciales salen de `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` y no se
 * envían al navegador: la respuesta solo lleva la cookie de sesión.
 */
export async function POST(request: Request) {
  const credentials = getDemoCredentials();

  if (!credentials) {
    return Response.json(
      {
        error: {
          code: "DEMO_NOT_CONFIGURED",
          message: "La cuenta de demostración no está disponible.",
        },
      },
      { status: 404 },
    );
  }

  try {
    const response = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
      headers: request.headers,
      asResponse: true,
    });

    if (!response.ok) {
      throw new Error(`Demo sign-in failed with status ${response.status}`);
    }

    // Solo se reenvía la cookie: el cuerpo de Better Auth incluye el correo.
    const headers = new Headers({ "Content-Type": "application/json" });

    for (const cookie of response.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error) {
    // Lo habitual: falta ejecutar el seed o la contraseña del entorno cambió.
    console.error("[auth] Demo sign-in failed:", error);

    return Response.json(
      {
        error: {
          code: "DEMO_SIGN_IN_FAILED",
          message: "No se pudo entrar con la cuenta de demostración.",
        },
      },
      { status: 500 },
    );
  }
}
