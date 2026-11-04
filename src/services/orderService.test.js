import { describe, expect, it } from "vitest";
import { mapOrderStatus, normalizeCancelledOrder } from "./orderService";

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
