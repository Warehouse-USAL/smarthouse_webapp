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
