import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { productService } from "./productService";

const queryPage = (ids, totalElements = ids.length, totalPages = 1) => ({
  data: {
    items: ids.map((id) => ({ id })),
    pagination: { page: 0, size: 8, total_elements: totalElements, total_pages: totalPages },
  },
});

describe("productService.listPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide la página al servidor y el detalle solo de esas filas", async () => {
    apiClient.post.mockResolvedValue(queryPage(["p1", "p2"], 20, 10));
    apiClient.get.mockImplementation(async (url) => ({
      data: { product: { id: url.split("/").pop(), sku: "SKU", active: false } },
    }));

    const result = await productService.listPage({
      page: 3,
      size: 2,
      searchField: "sku",
      search: "tal",
      category: "OTROS",
      active: false,
    });

    expect(apiClient.post).toHaveBeenCalledWith("/query/products", {
      filters: [
        { field: "sku", op: "contains", value: "tal" },
        { field: "category", op: "eq", value: "OTROS" },
        { field: "active", op: "eq", value: false },
      ],
      page: 2,
      size: 2,
      fields: ["id"],
    });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.get).toHaveBeenCalledWith("/products/p1", { params: { isActive: false } });
    expect(result.items.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result).toMatchObject({ totalPages: 10, totalElements: 20 });
  });

  it("sin filtros no manda ninguno: activos e inactivos", async () => {
    apiClient.post.mockResolvedValue(queryPage([]));

    await productService.listPage();

    expect(apiClient.post.mock.calls[0][1].filters).toEqual([]);
  });

  it("una zona sin productos devuelve página vacía sin pegarle al backend", async () => {
    const result = await productService.listPage({ includeIds: [] });

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], totalPages: 0, totalElements: 0 });
  });

  it("parte excludeIds en filtros nin de hasta 100 ids", async () => {
    apiClient.post.mockResolvedValue(queryPage([]));
    const excludeIds = Array.from({ length: 150 }, (_, i) => `p${i}`);

    await productService.listPage({ excludeIds });

    const { filters } = apiClient.post.mock.calls[0][1];
    expect(filters.map((f) => [f.op, f.value.length])).toEqual([
      ["nin", 100],
      ["nin", 50],
    ]);
  });

  it("falla con un mensaje claro si la zona supera los 100 productos", async () => {
    const includeIds = Array.from({ length: 101 }, (_, i) => `p${i}`);

    await expect(productService.listPage({ includeIds })).rejects.toThrow(/más de 100/);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe("productService.count", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve el total sin traer el detalle", async () => {
    apiClient.post.mockResolvedValue(queryPage(["p1"], 14));

    expect(await productService.count({ active: true, excludeIds: ["p9"] })).toBe(14);
    expect(apiClient.post.mock.calls[0][1]).toMatchObject({ page: 0, size: 1 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

describe("listPage con orden", () => {
  beforeEach(() => vi.clearAllMocks());

  it("manda sort al backend solo si viene", async () => {
    apiClient.post.mockResolvedValue({ data: { items: [], pagination: {} } });
    await productService.listPage({ page: 1, size: 8, active: true });
    expect(apiClient.post.mock.calls[0][1].sort).toBeUndefined();
    await productService.listPage({ page: 2, size: 8, active: true, sort: { field: "name", dir: "desc" } });
    expect(apiClient.post.mock.calls[1][1]).toMatchObject({
      sort: [{ field: "name", dir: "desc" }],
      page: 1,
    });
  });
});

describe("list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("manda isActive como lo espera GET /products", async () => {
    apiClient.get.mockResolvedValue({ data: { products: [] } });
    await productService.list({ isActive: true });
    expect(apiClient.get.mock.calls[0][1].params).toEqual({ page: 0, size: 50, isActive: true });
  });
});
