import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { vehicleService } from "./vehicleService";

describe("vehicleService.listPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pagina en el servidor con filtros y trae el detalle de cada fila", async () => {
    apiClient.post.mockResolvedValue({
      data: {
        items: [{ id: "v1" }],
        pagination: { page: 1, size: 10, total_elements: 11, total_pages: 2 },
      },
    });
    apiClient.get.mockResolvedValue({
      data: { vehicle: { id: "v1", name: "VEH-1", status: "idle", position: { x: 1, y: 2 } } },
    });

    const result = await vehicleService.listPage({ page: 2, size: 10, search: "veh", status: "IDLE" });

    expect(apiClient.post).toHaveBeenCalledWith("/query/vehicles", {
      filters: [
        { field: "name", op: "contains", value: "veh" },
        { field: "status", op: "eq", value: "IDLE" },
      ],
      sort: [{ field: "name", dir: "asc" }],
      page: 1,
      size: 10,
      fields: ["id"],
    });
    expect(apiClient.get).toHaveBeenCalledWith("/vehicles/v1");
    expect(result.items[0]).toMatchObject({ id: "v1", status: "IDLE" });
    expect(result).toMatchObject({ totalPages: 2, totalElements: 11 });
  });
});
