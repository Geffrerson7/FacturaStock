import type { Category } from "./category";
import type { PaginationMeta } from "./pagination";

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  /** Precio mínimo de venta con IGV. Sin valor, el mínimo es `price`. */
  minPrice: string | null;
  stock: number;
  /** Con `stock <= lowStockThreshold` el producto tiene stock bajo. */
  lowStockThreshold: number;
  /** Último costo de entrada, costo promedio y valor del inventario. */
  lastCost: string;
  averageCost: string;
  inventoryValue: string;
  isActive: boolean;
  imageUrl: string | null;
  imagePublicId: string | null;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
};

export type ProductsPageResponse = {
  data: Product[];
  pagination: PaginationMeta;
};
