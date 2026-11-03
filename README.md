# FacturaStock — Inventario y ventas

Aplicación de inventario y punto de venta construida con **Next.js 16** y **PostgreSQL**. Incluye administración de clientes (DNI/RUC), productos, categorías y ventas, además de la emisión de comprobantes electrónicos (facturas y boletas) mediante **Nubefact**.

## Funcionalidades

- **Clientes**
  - Registro de personas naturales con DNI y empresas con RUC.
  - CRUD con validaciones, búsqueda por documento y paginación.
  - Cliente walk-in (`DNI 00000000`) para ventas sin cliente identificado.

- **Productos**
  - CRUD con SKU único, precio, stock, categoría y estado activo/inactivo.
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

- **Interfaz**
  - Pantallas de login y registro con validación en cliente.
  - Panel de administración con sidebar y opción activa resaltada.
  - Imagen de fondo SVG propia en login y registro.

> **Nota:** el login y el registro son solo interfaz. Todavía no existe autenticación real ni protección de las rutas `/admin`.

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

Sin las variables de Nubefact, las ventas se registran igual y el comprobante queda en estado `PENDIENTE`.

> No subas `.env` al repositorio. Usa `.env.example` como plantilla.

### 3. Levantar PostgreSQL

Con Docker Compose:

```bash
docker compose up -d
```

O apunta `DATABASE_URL` a tu instancia propia.

### 4. Aplicar migraciones y datos de ejemplo

```bash
pnpm db:deploy   # aplica las migraciones existentes
pnpm db:seed     # categorías, productos y cliente walk-in de ejemplo
```

### 5. Iniciar el servidor

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

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
| `pnpm db:generate` | Regenera el cliente de Prisma. |
| `pnpm db:validate` | Valida `prisma/schema.prisma`. |
| `pnpm db:migrate` | Crea y aplica una migración en desarrollo. |
| `pnpm db:deploy` | Aplica migraciones pendientes (producción/CI). |
| `pnpm db:push` | Sincroniza el esquema sin crear migraciones. |
| `pnpm db:reset` | Borra y recrea la base, reaplica migraciones y ejecuta el seed. |
| `pnpm db:seed` | Ejecuta `prisma/seed.ts`. |
| `pnpm db:studio` | Abre Prisma Studio. |

Para verificar tipos sin generar build:

```bash
pnpm exec tsc --noEmit
```

## Rutas de la aplicación

| Ruta | Descripción |
| --- | --- |
| `/` | Login (interfaz). |
| `/register` | Registro (interfaz). |
| `/admin/dashboard` | Dashboard (placeholder). |
| `/admin/clientes` | Gestión de clientes. |
| `/admin/productos` | Gestión de productos. |
| `/admin/categorias` | Gestión de categorías. |
| `/admin/ventas` | Registro e historial de ventas. |

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health/db` | Verifica la conexión con PostgreSQL. |
| `GET` / `POST` | `/api/clientes` | Lista paginada y crea clientes. |
| `PUT` / `DELETE` | `/api/clientes/[id]` | Actualiza y elimina un cliente. |
| `GET` / `POST` | `/api/productos` | Lista paginada y crea productos. |
| `PUT` / `DELETE` | `/api/productos/[id]` | Actualiza y elimina un producto. |
| `GET` / `POST` | `/api/categorias` | Lista paginada y crea categorías. |
| `PUT` / `DELETE` | `/api/categorias/[id]` | Actualiza y elimina una categoría. |
| `GET` / `POST` | `/api/ventas` | Lista paginada y registra ventas (emite comprobante). |
| `POST` | `/api/ventas/[id]/anular` | Anula la venta, repone stock y anula el comprobante. |
| `POST` | `/api/ventas/[id]/comprobante` | Reintenta la emisión de un comprobante pendiente. |

Los listados aceptan `page` y `pageSize` (máximo 100).

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

## Estructura del proyecto

```text
app/
  admin/            # Dashboard, clientes, productos, categorías y ventas
  api/              # Route Handlers de la API
  register/         # Pantalla de registro
  page.tsx          # Login
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
  lib/nubefact.ts   # Integración con Nubefact
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

`Customer`, `Category`, `Product`, `Sale`, `SaleItem`, `Invoice` e `InvoiceCounter`
(ver `prisma/schema.prisma`).

### Notas de Prisma 7

- El generador es `prisma-client` y **requiere** `output`; el cliente ya no se genera dentro de `node_modules`.
- No hay motor de Rust: PostgreSQL se conecta mediante el driver adapter `@prisma/adapter-pg` (`pg`), configurado en `src/lib/prisma.ts`.
- `prisma.config.ts` es el archivo de configuración de la CLI y carga `.env` explícitamente con `import "dotenv/config"`.
- Si usas un proveedor con pooler (Neon, Supabase), usa la URL directa para las migraciones (`pnpm db:migrate` / `pnpm db:deploy`).

## Limitaciones actuales

- No hay autenticación real: login y registro son solo interfaz y las rutas del admin no están protegidas.
- El dashboard es un placeholder.
- Solo se emiten facturas y boletas; no hay notas de crédito ni débito.
- La emisión real requiere credenciales válidas de Nubefact.

## Recursos

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Prisma ORM 7](https://www.prisma.io/docs/orm)
- [Documentación de HeroUI](https://www.heroui.com/docs)
- [Nubefact](https://www.nubefact.com/)
