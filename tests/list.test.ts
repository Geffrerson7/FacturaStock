import { describe, expect, it } from "vitest";

import { buildListUrl } from "@/src/lib/hooks/usePaginatedList";
import { getPageItems } from "@/src/lib/pagination";

describe("getPageItems", () => {
  it("lista todas las páginas cuando son siete o menos", () => {
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPageItems(1, 0)).toEqual([]);
  });

  it("recorta con puntos suspensivos alrededor de la página actual", () => {
    expect(getPageItems(10, 20)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
      20,
    ]);
  });

  it("no pone puntos suspensivos junto a los extremos", () => {
    expect(getPageItems(1, 20)).toEqual([1, 2, "ellipsis", 20]);
    expect(getPageItems(20, 20)).toEqual([1, "ellipsis", 19, 20]);
  });
});

describe("buildListUrl", () => {
  it("incluye la paginación y omite los filtros vacíos", () => {
    expect(
      buildListUrl("/api/productos", 2, 10, {
        q: "",
        categoryId: "abc",
        isActive: "",
      }),
    ).toBe("/api/productos?page=2&pageSize=10&categoryId=abc");
  });

  it("codifica el texto de búsqueda", () => {
    expect(buildListUrl("/api/clientes", 1, 10, { q: "pérez & cía" })).toBe(
      "/api/clientes?page=1&pageSize=10&q=p%C3%A9rez+%26+c%C3%ADa",
    );
  });
});
