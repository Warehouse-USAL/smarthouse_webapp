import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { stockAdjustmentService } from "./stockAdjustmentService";

const row = {
  id: "adj-1",
  position_id: "pos-1",
  product_id: "p1",
  type: "DAMAGE",
  reason: "rotas",
  quantity_before: 14,
  quantity_after: 8,
  adjusted_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  cancelled_order_ids: ["o1"],
};

describe("listProductAdjustments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide la página del producto y normaliza el historial", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        stock_adjustments: [row],
        pagination: { page: 0, size: 10, total_elements: 1, total_pages: 1 },
      },
    });

    const result = await stockAdjustmentService.listProductAdjustments("p1", {
      page: 1,
      size: 10,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/products/p1/stock-adjustments", {
      params: { page: 0, size: 10 },
    });
    expect(result.totalElements).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0]).toEqual({
      id: "adj-1",
      positionId: "pos-1",
      productId: "p1",
      type: "DAMAGE",
      reason: "rotas",
      quantityBefore: 14,
      quantityAfter: 8,
      adjustedBy: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      cancelledOrderIds: ["o1"],
    });
  });

  it("traduce page 1-based a 0-based", async () => {
    apiClient.get.mockResolvedValue({
      data: { stock_adjustments: [], pagination: { total_pages: 0, total_elements: 0 } },
    });
    await stockAdjustmentService.listProductAdjustments("p1", { page: 3, size: 5 });
    expect(apiClient.get).toHaveBeenCalledWith("/products/p1/stock-adjustments", {
      params: { page: 2, size: 5 },
    });
  });
});
