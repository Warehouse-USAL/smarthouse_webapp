import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { restockService } from "./restockService";

const order = (extra) => ({
  id: "o1",
  product_id: "p1",
  quantity_requested: 10,
  supplier: "ACME",
  created_at: "2026-10-01T10:00:00Z",
  ...extra,
});

const mockBackend = (orders, receptions = []) =>
  apiClient.get.mockImplementation(async (url) =>
    url === "/restock/orders"
      ? { data: { restock_orders: orders, pagination: { total_pages: 1, total_elements: orders.length } } }
      : { data: { receptions, pagination: { total_pages: 1, total_elements: receptions.length } } }
  );

describe("estado de las órdenes de restock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("backend viejo (sin status): se deriva de lo recibido", async () => {
    mockBackend([order()]);
    const { items } = await restockService.listOrdersPage();
    expect(items[0].status).toBe("pendiente");
  });

  it("backend nuevo PENDING: se sigue derivando", async () => {
    mockBackend(
      [order({ status: "PENDING" })],
      [{ id: "r1", restock_order_id: "o1", product_id: "p1", quantity_received: 4 }]
    );
    const { items } = await restockService.listOrdersPage();
    expect(items[0].status).toBe("recibido");
  });

  it("CANCELLED gana sobre lo derivado y expone los campos nuevos", async () => {
    mockBackend([
      order({
        status: "CANCELLED",
        expected_delivery_date: "2026-10-08T10:00:00Z",
        cancelled_at: "2026-10-02T10:00:00Z",
        cancellation_reason: "Duplicada",
      }),
    ]);
    const { items } = await restockService.listOrdersPage();
    expect(items[0].status).toBe("cancelado");
    expect(items[0].cancellationReason).toBe("Duplicada");
    expect(items[0].expectedDeliveryDate).toBe("2026-10-08T10:00:00Z");
  });

  it("las canceladas no se ofrecen como órdenes abiertas", async () => {
    mockBackend([order({ status: "CANCELLED" }), order({ id: "o2", status: "PENDING" })]);
    const open = await restockService.listOpenOrders();
    expect(open.map((o) => o.id)).toEqual(["o2"]);
  });
});
