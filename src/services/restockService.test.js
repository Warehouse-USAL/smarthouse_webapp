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
    expect(items[0].status).toBe("recibido_parcial");
  });

  it("recibir lo mismo que lo pedido queda recibido y deja de estar abierta", async () => {
    mockBackend(
      [order({ status: "PENDING" })],
      [{ id: "r1", restock_order_id: "o1", product_id: "p1", quantity_received: 10 }]
    );
    const { items } = await restockService.listOrdersPage();
    expect(items[0].status).toBe("recibido");
    expect(await restockService.listOpenOrders()).toEqual([]);
  });

  it("una recepción parcial sigue abierta para recibir el resto", async () => {
    mockBackend(
      [order({ status: "PENDING" })],
      [{ id: "r1", restock_order_id: "o1", product_id: "p1", quantity_received: 4 }]
    );
    const open = await restockService.listOpenOrders();
    expect(open.map((o) => o.status)).toEqual(["recibido_parcial"]);
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

describe("alertFor (botón de restock en Productos)", () => {
  beforeEach(() => vi.clearAllMocks());

  const product = (extra) => ({
    id: "p1",
    name: "Café",
    sku: "CAF-1",
    availableStock: 2,
    minimumStock: 10,
    ...extra,
  });

  it("usa el restock guardado por la corrida diaria sin pedir nada", async () => {
    const alert = await restockService.alertFor(
      product({ restock: { should_restock: true, suggested_quantity: 40, reorder_point: 12 } })
    );
    expect(alert.suggestedQuantity).toBe(40);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("sin restock guardado pide la simulación en vivo solo para ese producto", async () => {
    apiClient.get.mockResolvedValue({
      data: { computed_metrics: [{ name: "restock_suggestions", path: "/metrics/restock-suggestions" }] },
    });
    apiClient.post.mockResolvedValue({
      data: { data: [{ product_id: "p1", should_restock: true, suggested_quantity: 25 }] },
    });
    const alert = await restockService.alertFor(product());
    expect(alert.suggestedQuantity).toBe(25);
    expect(apiClient.post.mock.calls[0][1].filters).toEqual({ product_ids: ["p1"] });
  });
});
