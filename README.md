# FacturaStock — Inventario y ventas

Aplicación de inventario y punto de venta construida con **Next.js 16** y **PostgreSQL**. Incluye administración de clientes (DNI/RUC), productos, categorías y ventas, además de la emisión de comprobantes electrónicos (facturas y boletas) mediante **Nubefact**.

## Funcionalidades

- **Clientes**
  - Registro de personas naturales con DNI y empresas con RUC.
  - CRUD con validaciones, búsqueda por documento y paginación.
  - Consulta de DNI (RENIEC) y RUC (SUNAT) para autocompletar los datos del cliente.
  - Cliente walk-in (`DNI 00000000`) para ventas sin cliente identificado.

- **Productos**
  - CRUD con SKU único, precio, stock, categoría y estado activo/inactivo.
  - Imagen del producto subida a Cloudinary (archivo, arrastrar y soltar o URL), guardada en la base y mostrada con un avatar en el listado.
  - Paginación y control de stock.

- **Categorías**
  - Módulo propio con tabla paginada, creación y edición.
  - Conteo de productos por categoría.
  - No se puede eliminar una categoría que tenga productos asignados.

- **Ventas**
  - Registro de ventas con descuento automático de stock.
  - Anulación con reposición de stock.
  - Historial paginado con detalle de productos.

- **Comprobantes electrónicos (Nubefact)**
  - RUC → **Factura** (serie `FFF1`).
  - DNI → **Boleta** (serie `BBB1`).
  - Venta sin cliente o walk-in → boleta con documento `-` y número `0`.
  - Precios con IGV incluido (18 %).
  - Emisión automática al registrar la venta.
  - Si Nubefact falla, la venta se guarda y el comprobante queda **PENDIENTE** para reintentar.
  - Anulación del comprobante en Nubefact al anular la venta.
  - Se guardan estado SUNAT, enlaces PDF/XML/CDR, hash, QR y respuesta de Nubefact.

- **Autenticación**
  - Inicio y cierre de sesión con correo y contraseña (Better Auth, sesiones en la base).
  - Roles `ADMIN` y `DEMO`: el usuario de demostración solo puede leer (peticiones `GET`).
  - Panel `/admin` y API protegidos; el registro está cerrado por defecto.

- **Interfaz**
  - Pantallas de login y registro con validación en cliente.
  - Panel de administración con sidebar y opción activa resaltada.
  - Imagen de fondo SVG propia en login y registro.

## Stack

| Tecnología | Versión / uso |
| --- | --- |
| Next.js | 16.4.2 (App Router, Turbopack, Cache Components) |
| React | 19.3.0 |
| HeroUI | 3.2.6 |
| Tailwind CSS | 4 (integración con Turbopack) |
| Prisma ORM | 7.10.1 con generador `prisma-client` y `@prisma/adapter-pg` |
| PostgreSQL | 17 |
| Zod | 4.6.7 |
| Nubefact | API JSON v1 para comprobantes electrónicos |

## Requisitos

- Node.js 20.9 o superior
- pnpm
- PostgreSQL 17 (local o con Docker)
- Credenciales de Nubefact para emitir comprobantes reales

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

El `postinstall` ejecuta `prisma generate`.

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# En Windows: Copy-Item .env.example .env
```

Completa los valores en `.env`:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL. |
| `NUBEFACT_API_URL` | Para facturar | URL de la API de Nubefact (incluye el identificador de la cuenta). |
| `NUBEFACT_API_TOKEN` | Para facturar | Token de autenticación de Nubefact. |
| `DECOLECTA_API_TOKEN` | Para consultar documentos | Token de Decolecta para consultar DNI y RUC. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Para subir imágenes | Cloud name de Cloudinary (público). |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | Para subir imágenes | API key de Cloudinary (público). |
| `CLOUDINARY_API_SECRET` | Para subir imágenes | API secret de Cloudinary. Solo se usa en el servidor para firmar las subidas. |
| `BETTER_AUTH_SECRET` | Sí | Secreto que firma las cookies de sesión. Genera uno con `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Sí | URL pública de la aplicación (`http://localhost:3000` en desarrollo). |
| `AUTH_ALLOW_SIGNUP` | No | `true` abre el registro en `/register`. Por defecto está cerrado. |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | No | Credenciales del usuario de demostración (solo lectura). Activan el botón "Entrar como demo" y solo se leen en el servidor. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | No | Si se definen, `pnpm db:seed` crea un administrador con esas credenciales. |

Sin las variables de Nubefact, las ventas se registran igual y el comprobante queda en estado `PENDIENTE`.

> No subas `.env` al repositorio. Usa `.env.example` como plantilla.

### 3. Levantar PostgreSQL

Con Docker Compose:

```bash
docker compose up -d
```

O apunta `DATABASE_URL` a tu instancia propia.

La base se llama `facturastock`. Si vienes de una versión anterior con la base
`my_inventory`, puedes crear la nueva a partir de la anterior sin perder datos:

```bash
docker compose exec postgres createdb -U postgres -T my_inventory facturastock
```

Después actualiza `DATABASE_URL` en `.env` para que termine en
`/facturastock?schema=public`.

### 4. Aplicar migraciones y datos de ejemplo

```bash
pnpm db:deploy   # aplica las migraciones existentes
pnpm db:seed     # usuarios, categorías, productos y cliente walk-in de ejemplo
```

El seed crea el usuario de demostración (solo lectura) si defines
`DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD`, y un administrador con permisos
completos si defines `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Si cambias
alguna de esas contraseñas, vuelve a ejecutar el seed.

### 5. Iniciar el servidor

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

Inicia sesión con el administrador del seed o con el botón "Entrar como demo".

Verifica la conexión a la base de datos:

```bash
curl http://localhost:3000/api/health/db
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` | Genera Prisma y crea el build de producción. |
| `pnpm start` | Inicia el build de producción. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm typecheck` | Verifica los tipos con `tsc --noEmit`. |
| `pnpm test` | Ejecuta los tests una vez con Vitest. |
| `pnpm test:watch` | Ejecuta los tests en modo vigilancia. |
| `pnpm db:generate` | Regenera el cliente de Prisma. |
| `pnpm db:validate` | Valida `prisma/schema.prisma`. |
| `pnpm db:migrate` | Crea y aplica una migración en desarrollo. |
| `pnpm db:deploy` | Aplica migraciones pendientes (producción/CI). |
| `pnpm db:push` | Sincroniza el esquema sin crear migraciones. |
| `pnpm db:reset` | Borra y recrea la base, reaplica migraciones y ejecuta el seed. |
| `pnpm db:seed` | Ejecuta `prisma/seed.ts`. |
| `pnpm db:studio` | Abre Prisma Studio. |

Los tests cubren el cálculo de IGV por línea y los totales de los comprobantes
en `tests/nubefact.test.ts`, y la protección de la API (401 sin sesión, 403 para el
usuario de demostración) en `tests/auth.test.ts`. El flujo de integración continua en
`.github/workflows/ci.yml` ejecuta lint, tipos, tests y build en cada pull
request.

## Rutas de la aplicación

| Ruta | Descripción |
| --- | --- |
| `/` | Login. |
| `/register` | Registro (solo con `AUTH_ALLOW_SIGNUP=true`). |
| `/admin/dashboard` | Dashboard (placeholder). |
| `/admin/clientes` | Gestión de clientes. |
| `/admin/productos` | Gestión de productos. |
| `/admin/categorias` | Gestión de categorías. |
| `/admin/ventas` | Registro e historial de ventas. |

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` / `POST` | `/api/auth/*` | Inicio de sesión, registro, cierre y lectura de sesión (Better Auth). Pública. |
| `GET` | `/api/health/db` | Verifica la conexión con PostgreSQL. Pública; solo responde `ok` o `error`. |
| `GET` / `POST` | `/api/clientes` | Lista paginada y crea clientes. |
| `PUT` / `DELETE` | `/api/clientes/[id]` | Actualiza y elimina un cliente. |
| `GET` | `/api/consulta/dni` | Consulta los datos de un DNI en RENIEC (Decolecta). |
| `GET` | `/api/consulta/ruc` | Consulta los datos de un RUC en SUNAT (Decolecta). |
| `POST` | `/api/cloudinary/signature` | Firma una subida a la carpeta de productos de Cloudinary. |
| `GET` / `POST` | `/api/productos` | Lista paginada y crea productos. |
| `PUT` / `DELETE` | `/api/productos/[id]` | Actualiza y elimina un producto. |
| `GET` / `POST` | `/api/categorias` | Lista paginada y crea categorías. |
| `PUT` / `DELETE` | `/api/categorias/[id]` | Actualiza y elimina una categoría. |
| `GET` / `POST` | `/api/ventas` | Lista paginada y registra ventas (emite comprobante). |
| `POST` | `/api/ventas/[id]/anular` | Anula la venta, repone stock y anula el comprobante. |
| `POST` | `/api/ventas/[id]/comprobante` | Reintenta la emisión de un comprobante pendiente. |

Los listados aceptan `page` y `pageSize` (máximo 100).

Salvo `/api/auth/*` y `/api/health/db`, todos los endpoints exigen sesión:
responden `401` sin ella y `403` cuando el usuario de demostración intenta algo
que no sea una lectura. Las consultas de DNI y RUC están limitadas a 10 por
minuto por usuario.

## Facturación electrónica

La integración vive en:

- `src/lib/nubefact.ts`: cliente HTTP, cálculo de IGV, payload, consulta y anulación.
- `src/lib/api/invoice.ts`: emisión, reintento y recuperación de comprobantes existentes.
- `app/api/ventas/route.ts`: reserva del correlativo y creación de la venta.

Estados del comprobante:

| Estado | Significado |
| --- | --- |
| `PENDIENTE` | No se pudo emitir todavía; se puede reintentar. |
| `EMITIDO` | Aceptado por Nubefact/SUNAT; incluye enlaces y respuesta. |
| `ANULADO` | Comprobante anulado. |
| `ANULACION_PENDIENTE` | Nubefact devolvió un ticket de anulación pendiente de confirmación. |

Los correlativos se guardan en `invoice_counters` y se reservan en la misma transacción que crea la venta. El reintento reutiliza el número ya asignado.

La documentación de referencia de la API está en `NUBEFACT DOC API JSON V1.md`.

## Imágenes de productos

Las imágenes se eligen desde el formulario de productos de tres formas: subiendo un archivo (`JPG`, `PNG` o `WebP` de hasta 5 MB), arrastrándolo sobre el área de imagen o pegando una URL pública. En los tres casos la imagen se almacena en la carpeta `facturastock/products` de Cloudinary.

La subida es **firmada**: el navegador pide la firma a `POST /api/cloudinary/signature` y envía el archivo (o la URL remota) a la API de subida de Cloudinary con esa firma. El servidor fija la carpeta y el `timestamp` que firma, así que la firma no sirve para otra carpeta ni para otros parámetros. El `CLOUDINARY_API_SECRET` nunca sale del servidor. La URL segura y el `public_id` se guardan en `products.image_url` e `products.image_public_id`, y el listado los muestra con un `Avatar` de HeroUI.

Al quitar la imagen de un producto solo se borra la referencia en la base de datos; el archivo permanece en Cloudinary.

## Estructura del proyecto

```text
app/
  admin/            # Dashboard, clientes, productos, categorías y ventas
  api/              # Route Handlers de la API
  register/         # Pantalla de registro
  page.tsx          # Login
proxy.ts            # Comprobación optimista de la cookie de sesión
components/
  admin/            # Sidebar
  categorias/       # Tabla y formularios de categorías
  clientes/         # Tabla y formularios de clientes
  login/            # Formulario de login
  productos/        # Tabla y formularios de productos
  register/         # Formulario de registro
  ventas/           # Tabla, formulario y anulación de ventas
prisma/
  migrations/       # Migraciones de la base de datos
  schema.prisma     # Modelos y enums
  seed.ts           # Datos de ejemplo
public/             # Logo, wallpaper SVG y recursos estáticos
src/
  generated/prisma/ # Cliente de Prisma generado (no versionado)
  lib/api/          # Lógica compartida de la API
  lib/types/        # Tipos de dominio del frontend
  lib/validations/  # Esquemas Zod
  lib/prisma.ts     # Instancia compartida de Prisma
  lib/auth.ts       # Configuración de Better Auth
  lib/auth-policy.ts # Roles y reglas de acceso
  lib/api/session.ts # requireSession para los Route Handlers
  lib/nubefact.ts   # Integración con Nubefact
  lib/decolecta.ts  # Consulta de DNI y RUC con Decolecta
```

## Prisma

El cliente generado se escribe en `src/generated/prisma` (ignorado por git) e incluye tipos para todos los modelos. Se regenera con `pnpm install`, `pnpm db:generate` y antes de `pnpm build`.

La instancia compartida vive en `src/lib/prisma.ts`:

```ts
import { prisma } from "@/src/lib/prisma";

const products = await prisma.product.findMany({
  include: { category: true },
  orderBy: { name: "asc" },
});
```

### Modelos

`Customer`, `Category`, `Product`, `Sale`, `SaleItem`, `Invoice`, `InvoiceCounter`
y los de autenticación `User`, `Session`, `Account` y `Verification`
(ver `prisma/schema.prisma`).

### Notas de Prisma 7

- El generador es `prisma-client` y **requiere** `output`; el cliente ya no se genera dentro de `node_modules`.
- No hay motor de Rust: PostgreSQL se conecta mediante el driver adapter `@prisma/adapter-pg` (`pg`), configurado en `src/lib/prisma.ts`.
- `prisma.config.ts` es el archivo de configuración de la CLI y carga `.env` explícitamente con `import "dotenv/config"`.
- Si usas un proveedor con pooler (Neon, Supabase), usa la URL directa para las migraciones (`pnpm db:migrate` / `pnpm db:deploy`).

## Autenticación

La autenticación usa [Better Auth](https://www.better-auth.com) con correo y
contraseña y sesiones guardadas en PostgreSQL.

- **Dos capas.** `proxy.ts` hace una comprobación rápida de la cookie para
  `/admin/*` y `/api/*`. La validación real ocurre después: el layout de
  `/admin` llama a `getCurrentUser()` y cada Route Handler empieza con
  `requireSession(request)`.
- **Roles.** `ADMIN` tiene acceso completo. `DEMO` solo puede hacer peticiones
  `GET`: cualquier otro método responde `403 DEMO_READ_ONLY`. Tampoco puede
  usar las consultas de DNI y RUC, porque gastan cuota de Decolecta.
- **Cuenta de demostración.** El botón "Entrar como demo" llama a
  `POST /api/auth/demo`, que inicia la sesión en el servidor con
  `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD`. Las credenciales no aparecen en la
  página ni en el código del navegador. Sin esas variables, el botón no se
  muestra.
- **Registro.** Cerrado por defecto. Con `AUTH_ALLOW_SIGNUP=true` cada cuenta
  nueva es `ADMIN`, así que no lo abras en una demo pública.
- **Endpoints de Better Auth.** Solo se exponen inicio de sesión, registro,
  cierre y lectura de sesión. El resto (cambio de contraseña, de correo...)
  responde `404`, para que nadie cambie la contraseña de la cuenta de
  demostración.

## Limitaciones actuales

- No hay recuperación de contraseña ni gestión de usuarios desde la interfaz.
- El límite de las consultas de DNI y RUC se guarda en memoria, por proceso.
- El dashboard es un placeholder.
- Solo se emiten facturas y boletas; no hay notas de crédito ni débito.
- La emisión real requiere credenciales válidas de Nubefact.

## Recursos

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Prisma ORM 7](https://www.prisma.io/docs/orm)
- [Documentación de HeroUI](https://www.heroui.com/docs)
- [Nubefact](https://www.nubefact.com/)
- [Better Auth](https://www.better-auth.com)
