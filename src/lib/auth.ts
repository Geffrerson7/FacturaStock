import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { isSignUpEnabled, USER_ROLES } from "./auth-policy";
import { prisma } from "./prisma";

/**
 * Instancia de Better Auth. Solo se usa en el servidor.
 *
 * Variables de entorno: `BETTER_AUTH_SECRET` (obligatoria en producción),
 * `BETTER_AUTH_URL` (URL pública de la aplicación) y `AUTH_ALLOW_SIGNUP`.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // El registro está cerrado salvo que AUTH_ALLOW_SIGNUP sea "true".
    disableSignUp: !isSignUpEnabled(),
    minPasswordLength: 8,
    maxPasswordLength: 72,
  },
  user: {
    additionalFields: {
      role: {
        type: [...USER_ROLES],
        required: false,
        defaultValue: "ADMIN",
        // El rol nunca se acepta desde el cliente.
        input: false,
      },
    },
  },
});
