import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { mapOrderStatus, normalizeCancelledOrder, orderService } from "./orderService";

describe("normalizeCancelledOrder", () => {
  it("mapea una orden de cancelled_orders y se muestra como falla por stock", () => {
    const order = normalizeCancelledOrder({
      id: "abc123def",
      cancel_reason: "INSUFFICIENT_STOCK: product X needs 4 units but only 2 remain available",
      created_at: "2026-10-01T10:00:00Z",
    });
    expect(order.code).toBe("OC-123DEF");
    expect(order.cancelReason).toContain("INSUFFICIENT_STOCK");
    expect(mapOrderStatus(order).key).toBe("falla_stock");
  });
});

describe("listPage (POST /query/orders)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ordena en el servidor y traduce filtros y estado", async () => {
    apiClient.post.mockResolvedValue({
      data: {
        items: [{ id: "o1", status: "IN_PROGRESS", created_at: "2026-11-11T10:00:00Z" }],
        pagination: { total_pages: 3, total_elements: 25 },
      },
    });
    const result = await orderService.listPage({
      page: 2,
      size: 8,
      status: "in_progress",
      from: "2026-11-01",
      sort: { field: "completed_at", dir: "asc" },
    });
    const [url, body] = apiClient.post.mock.calls[0];
    expect(url).toBe("/query/orders");
    expect(body.sort).toEqual([{ field: "completed_at", dir: "asc" }]);
    expect(body.page).toBe(1);
    expect(body.filters[0]).toEqual({ field: "status", op: "eq", value: "IN_PROGRESS" });
    expect(body.filters[1]).toMatchObject({ field: "created_at", op: "gte" });
    expect(result.items[0]).toMatchObject({ id: "o1", status: "in_progress", items: null });
    expect(result.totalElements).toBe(25);
  });

  it("sin sort pide las más nuevas primero", async () => {
    apiClient.post.mockResolvedValue({ data: { items: [], pagination: {} } });
    await orderService.listPage();
    expect(apiClient.post.mock.calls[0][1].sort).toEqual([{ field: "created_at", dir: "desc" }]);
  });
});
