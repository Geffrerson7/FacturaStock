/**
 * Catálogo de la demostración: categorías, productos y clientes ficticios.
 *
 * Los nombres, documentos y direcciones son inventados. Los RUC llevan un
 * dígito verificador válido para que Nubefact los acepte si el administrador
 * emite una factura a uno de estos clientes. Los correos usan example.com, un
 * dominio reservado que nunca recibe correo.
 */

export type ProductShape =
  | "bottle"
  | "can"
  | "bag"
  | "box"
  | "jar"
  | "carton"
  | "pack"
  | "roll"
  | "tube"
  | "sack";

export type DemoCategory = { name: string; description: string };

export type DemoProduct = {
  sku: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  lowStockThreshold: number;
  category: string;
  /** Peso relativo con el que aparece en las ventas de ejemplo (1 a 5). */
  popularity: number;
  /** Forma y color de su ilustración en `public/demo/products`. */
  shape: ProductShape;
  color: string;
};

export type DemoCustomer =
  | {
      documentType: "DNI";
      dni: string;
      firstName: string;
      lastName: string;
      address: string;
      phone: string;
      email: string;
    }
  | {
      documentType: "RUC";
      ruc: string;
      businessName: string;
      address: string;
      phone: string;
      email: string;
    };

export const DEMO_CATEGORIES: DemoCategory[] = [
  { name: "Bebidas", description: "Aguas, gaseosas, jugos y energizantes" },
  { name: "Snacks", description: "Piqueos, galletas y golosinas" },
  { name: "Abarrotes", description: "Arroz, aceite, conservas y despensa" },
  { name: "Lácteos", description: "Leche, yogur, queso y mantequilla" },
  { name: "Limpieza", description: "Artículos de limpieza del hogar" },
  { name: "Cuidado personal", description: "Higiene y cuidado personal" },
];

type ProductRow = [
  sku: string,
  name: string,
  description: string,
  price: string,
  stock: number,
  lowStockThreshold: number,
  popularity: number,
  shape: ProductShape,
  color: string,
];

const PRODUCTS_BY_CATEGORY: Record<string, ProductRow[]> = {
  Bebidas: [
    ["BEB-001", "Agua mineral 500 ml", "Botella de agua sin gas", "2.50", 50, 12, 5, "bottle", "#4fa3e0"],
    ["BEB-002", "Gaseosa 1.5 L", "Bebida gaseosa familiar", "6.50", 30, 8, 5, "bottle", "#c8102e"],
    ["BEB-003", "Agua mineral 2.5 L", "Bidón de agua sin gas", "4.20", 26, 6, 3, "bottle", "#6bb8e8"],
    ["BEB-004", "Jugo de naranja 1 L", "Néctar de naranja en caja", "5.90", 18, 5, 3, "carton", "#f59e0b"],
    ["BEB-005", "Bebida energizante 473 ml", "Lata de bebida energizante", "6.90", 4, 6, 2, "can", "#16a34a"],
    ["BEB-006", "Té helado 500 ml", "Té negro con limón", "3.20", 22, 6, 3, "bottle", "#b45309"],
    ["BEB-007", "Cerveza en lata 355 ml", "Cerveza rubia en lata", "4.50", 48, 12, 4, "can", "#d4a017"],
  ],
  Snacks: [
    ["SNK-001", "Papas fritas 150 g", "Papas fritas al natural", "3.50", 40, 10, 4, "bag", "#eab308"],
    ["SNK-002", "Galletas de chocolate", "Paquete de 6 unidades", "2.80", 35, 10, 4, "pack", "#7c3f1d"],
    ["SNK-003", "Maní salado 100 g", "Maní tostado con sal", "2.40", 3, 8, 2, "bag", "#c2410c"],
    ["SNK-004", "Chifles 90 g", "Plátano frito en hojuelas", "2.90", 20, 6, 2, "bag", "#65a30d"],
    ["SNK-005", "Barra de cereal 25 g", "Avena con miel", "1.50", 60, 15, 3, "pack", "#a16207"],
    ["SNK-006", "Chocolate de leche 80 g", "Tableta de chocolate con leche", "4.90", 0, 6, 2, "pack", "#78350f"],
  ],
  Abarrotes: [
    ["ABA-001", "Arroz extra 5 kg", "Arroz extra graneado", "21.90", 15, 5, 3, "sack", "#b9a77c"],
    ["ABA-002", "Azúcar rubia 1 kg", "Azúcar rubia de caña", "4.30", 30, 8, 3, "sack", "#c08a4a"],
    ["ABA-003", "Aceite vegetal 1 L", "Aceite vegetal comestible", "9.80", 24, 6, 3, "bottle", "#ca8a04"],
    ["ABA-004", "Fideos spaghetti 500 g", "Pasta de sémola de trigo", "3.60", 40, 10, 3, "pack", "#2563eb"],
    ["ABA-005", "Atún en conserva 170 g", "Filete de atún en aceite", "6.20", 28, 8, 3, "can", "#0e7490"],
    ["ABA-006", "Leche evaporada 400 g", "Leche evaporada entera", "4.10", 5, 10, 4, "can", "#1d4ed8"],
    ["ABA-007", "Café instantáneo 180 g", "Café soluble en frasco", "17.50", 12, 4, 2, "jar", "#5b3a1e"],
  ],
  Lácteos: [
    ["LAC-001", "Yogur de fresa 1 L", "Yogur bebible sabor fresa", "7.40", 14, 5, 3, "carton", "#ec4899"],
    ["LAC-002", "Queso fresco 500 g", "Queso fresco de vaca", "12.90", 8, 4, 2, "box", "#eab308"],
    ["LAC-003", "Mantequilla 200 g", "Mantequilla con sal", "8.50", 2, 5, 2, "box", "#f59e0b"],
    ["LAC-004", "Leche fresca 1 L", "Leche entera pasteurizada", "5.20", 20, 8, 3, "carton", "#3b82f6"],
  ],
  Limpieza: [
    ["LIM-001", "Detergente 1 kg", "Detergente en polvo", "12.90", 20, 5, 2, "bag", "#0ea5e9"],
    ["LIM-002", "Lejía 1 L", "Lejía tradicional", "3.90", 25, 6, 2, "bottle", "#8b5cf6"],
    ["LIM-003", "Lavavajillas 750 g", "Lavavajillas en pasta", "6.80", 18, 5, 2, "jar", "#22c55e"],
    ["LIM-004", "Papel higiénico 4 rollos", "Papel higiénico doble hoja", "6.50", 30, 8, 3, "roll", "#64748b"],
    ["LIM-005", "Esponja multiuso", "Paquete de 3 esponjas", "4.20", 16, 5, 1, "pack", "#f97316"],
  ],
  "Cuidado personal": [
    ["CUI-001", "Jabón de tocador", "Paquete de 3 jabones", "7.90", 22, 6, 2, "box", "#f472b6"],
    ["CUI-002", "Shampoo 400 ml", "Shampoo para todo tipo de cabello", "14.90", 10, 4, 1, "bottle", "#7c3aed"],
    ["CUI-003", "Pasta dental 90 g", "Crema dental con flúor", "5.50", 30, 8, 2, "tube", "#ef4444"],
    ["CUI-004", "Desodorante 150 ml", "Desodorante en aerosol", "11.90", 9, 4, 1, "can", "#334155"],
  ],
};

export const DEMO_PRODUCTS: DemoProduct[] = Object.entries(
  PRODUCTS_BY_CATEGORY,
).flatMap(([category, rows]) =>
  rows.map(
    ([sku, name, description, price, stock, lowStockThreshold, popularity, shape, color]) => ({
      sku,
      name,
      description,
      price,
      stock,
      lowStockThreshold,
      category,
      popularity,
      shape,
      color,
    }),
  ),
);

/** Ruta pública de la ilustración de un producto de la demo. */
export function demoProductImagePath(sku: string): string {
  return `/demo/products/${sku.toLowerCase()}.svg`;
}

/**
 * Completa un RUC de empresa (prefijo 20) con su dígito verificador, según el
 * algoritmo módulo 11 de SUNAT.
 */
export function rucWithCheckDigit(firstTenDigits: string): string {
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = [...firstTenDigits].reduce(
    (total, digit, index) => total + Number(digit) * factors[index],
    0,
  );
  const check = 11 - (sum % 11);

  return `${firstTenDigits}${check === 10 ? 0 : check === 11 ? 1 : check}`;
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  { documentType: "DNI", dni: "45871236", firstName: "María Elena", lastName: "Quispe Huamán", address: "Av. Arequipa 1450, Lince, Lima", phone: "987654321", email: "maria.quispe@example.com" },
  { documentType: "DNI", dni: "70214563", firstName: "Jorge Luis", lastName: "Ramírez Castillo", address: "Jr. Huancavelica 320, Cercado de Lima", phone: "956123478", email: "jorge.ramirez@example.com" },
  { documentType: "DNI", dni: "41236987", firstName: "Rosa Angélica", lastName: "Flores Mendoza", address: "Calle Los Pinos 145, Miraflores, Lima", phone: "912345876", email: "rosa.flores@example.com" },
  { documentType: "DNI", dni: "72569814", firstName: "Carlos Alberto", lastName: "Torres Vega", address: "Av. Brasil 2130, Jesús María, Lima", phone: "934567812", email: "carlos.torres@example.com" },
  { documentType: "DNI", dni: "46985213", firstName: "Lucía Fernanda", lastName: "Chávez Rojas", address: "Av. La Marina 980, San Miguel, Lima", phone: "945678123", email: "lucia.chavez@example.com" },
  { documentType: "DNI", dni: "73125846", firstName: "Diego Alonso", lastName: "Paredes Salazar", address: "Av. Universitaria 4250, Los Olivos, Lima", phone: "967812345", email: "diego.paredes@example.com" },
  { documentType: "DNI", dni: "40875632", firstName: "Ana Cecilia", lastName: "Gutiérrez Ríos", address: "Jr. Las Begonias 230, San Isidro, Lima", phone: "978123456", email: "ana.gutierrez@example.com" },
  { documentType: "DNI", dni: "71458932", firstName: "Luis Miguel", lastName: "Sánchez Ortiz", address: "Av. Próceres 1120, San Juan de Lurigancho, Lima", phone: "989012345", email: "luis.sanchez@example.com" },
  { documentType: "RUC", ruc: rucWithCheckDigit("2060158743"), businessName: "Bodega Don Lucho E.I.R.L.", address: "Av. Túpac Amaru 3450, Comas, Lima", phone: "014567890", email: "compras@bodegadonlucho.example.com" },
  { documentType: "RUC", ruc: rucWithCheckDigit("2060387125"), businessName: "Minimarket La Esquina S.A.C.", address: "Av. Benavides 1820, Surco, Lima", phone: "012345678", email: "logistica@laesquina.example.com" },
  { documentType: "RUC", ruc: rucWithCheckDigit("2060942318"), businessName: "Restaurante Sabor Norteño S.A.C.", address: "Jr. Junín 455, Barranco, Lima", phone: "013456789", email: "administracion@sabornorteno.example.com" },
  { documentType: "RUC", ruc: rucWithCheckDigit("2061275409"), businessName: "Distribuidora Andina del Sur S.A.C.", address: "Av. Industrial 780, Ate, Lima", phone: "015678901", email: "pedidos@andinadelsur.example.com" },
];
