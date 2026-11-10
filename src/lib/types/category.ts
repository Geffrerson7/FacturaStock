import type { PaginationMeta } from "./pagination";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryWithCount = Category & {
  productCount: number;
};

export type CategoriesPageResponse = {
  data: CategoryWithCount[];
  pagination: PaginationMeta;
};
