import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { patch: vi.fn(), get: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { warehouseConfigService } from "./warehouseConfigService";

describe("updatePosition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía reason y devuelve el cuerpo con cancelled_orders", async () => {
    const body = { id_position: "P1", current_stock: 3, cancelled_orders: [{ id: "o1" }] };
    apiClient.patch.mockResolvedValue({ data: body });

    const result = await warehouseConfigService.updatePosition("z", "l", "P1", {
      currentStock: 3,
      reason: "Ajuste manual",
    });

    expect(apiClient.patch).toHaveBeenCalledWith("/warehouse/positions/P1", {
      current_stock: 3,
      reason: "Ajuste manual",
    });
    expect(result).toBe(body);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("sin reason no manda la clave", async () => {
    apiClient.patch.mockResolvedValue({ data: {} });
    await warehouseConfigService.updatePosition("z", "l", "P1", { currentStock: 1 });
    expect(apiClient.patch).toHaveBeenCalledWith("/warehouse/positions/P1", { current_stock: 1 });
  });
});

describe("getProductZones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("arma producto → zonas con las posiciones activas en una sola request", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        positions: [
          { product_id: "p1", zone_code: "A", is_active: true },
          { product_id: "p1", zone_code: "B", is_active: true },
          { product_id: "p2", zone_code: "A", is_active: false },
          { product_id: null, zone_code: "A", is_active: true },
        ],
      },
    });

    const zones = await warehouseConfigService.getProductZones();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith("/warehouse/positions");
    expect([...zones.keys()]).toEqual(["p1"]);
    expect([...zones.get("p1")]).toEqual(["A", "B"]);
  });
});
