export type PageItem = number | "ellipsis";

/**
 * Números de página a mostrar: siempre la primera y la última, la actual con
 * `window` vecinas a cada lado, y puntos suspensivos en los saltos.
 */
export function getPageItems(
  current: number,
  total: number,
  window = 1,
): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - window);
  const end = Math.min(total - 1, current + window);
  const items: PageItem[] = [1];

  if (start > 2) items.push("ellipsis");

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < total - 1) items.push("ellipsis");

  items.push(total);

  return items;
}
