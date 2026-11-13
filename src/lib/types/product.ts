import type { Category } from "./category";
import type { PaginationMeta } from "./pagination";

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  stock: number;
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
