import type { Category } from "./category";
import type { PaginationMeta } from "./pagination";

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  stock: number;
  /** Con `stock <= lowStockThreshold` el producto tiene stock bajo. */
  lowStockThreshold: number;
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
