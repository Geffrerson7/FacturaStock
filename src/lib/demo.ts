/**
 * Credenciales del usuario de demostración, leídas del entorno
 * (`DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD`).
 *
 * Solo se usan en el servidor y en el seed: nunca llegan al navegador. El
 * botón "Entrar como demo" llama a `POST /api/auth/demo`, que inicia la sesión
 * con ellas. La cuenta tiene el rol `DEMO`, que solo puede leer.
 */
export type DemoCredentials = {
  name: string;
  email: string;
  password: string;
};

export function getDemoCredentials(): DemoCredentials | null {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD;

  if (!email || !password) return null;

  return { name: "Usuario demo", email, password };
}

export function isDemoLoginEnabled(): boolean {
  return getDemoCredentials() !== null;
}
