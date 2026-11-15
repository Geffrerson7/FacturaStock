export type StockLevel = "out" | "low" | "ok";

/** Nivel de stock de un producto según su propio umbral. */
export function getStockLevel(product: {
  stock: number;
  lowStockThreshold: number;
}): StockLevel {
  if (product.stock <= 0) return "out";
  if (product.stock <= product.lowStockThreshold) return "low";
  return "ok";
}
