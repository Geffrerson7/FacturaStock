import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { isSignUpEnabled, SIGNUP_ROLE, USER_ROLES } from "./auth-policy";
import { sendWelcomeEmail } from "./email";
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
  databaseHooks: {
    user: {
      create: {
        // Las cuentas creadas desde el registro nunca son ADMIN. `input: false`
        // ya impide que el cliente mande el rol; esto lo fija aunque el
        // valor por defecto cambie.
        before: async (user) => ({ data: { ...user, role: SIGNUP_ROLE } }),
        // Solo el registro pasa por Better Auth: el seed y el usuario demo se
        // crean con Prisma directamente, así que no reciben este correo.
        after: async (user) => {
          await sendWelcomeEmail(user);
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: [...USER_ROLES],
        required: false,
        defaultValue: SIGNUP_ROLE,
        // El rol nunca se acepta desde el cliente.
        input: false,
      },
    },
  },
});
