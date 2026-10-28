import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

import { apiClient } from "../lib/apiClient";
import { userService } from "./userService";

describe("userService supplier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create manda supplier solo si viene", async () => {
    apiClient.post.mockResolvedValue({ data: { id: "u1", supplier: "ACME" } });
    const user = await userService.create({
      email: "a@b.co",
      name: "A",
      role: "PROVIDER",
      initialPassword: "1234",
      supplier: "ACME",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/users", {
      email: "a@b.co",
      name: "A",
      role: "PROVIDER",
      initial_password: "1234",
      supplier: "ACME",
    });
    expect(user.supplier).toBe("ACME");

    await userService.create({ email: "a@b.co", name: "A", role: "OPERATOR", initialPassword: "1234" });
    expect(apiClient.post.mock.calls[1][1]).not.toHaveProperty("supplier");
  });

  it("update manda supplier solo si viene y el backend viejo normaliza a null", async () => {
    apiClient.patch.mockResolvedValue({ data: { id: "u1" } });
    const user = await userService.update("u1", { supplier: "ACME" });
    expect(apiClient.patch).toHaveBeenCalledWith("/users/u1", { supplier: "ACME" });
    expect(user.supplier).toBeNull();
    await userService.update("u1", { name: "B" });
    expect(apiClient.patch.mock.calls[1][1]).toEqual({ name: "B" });
  });
});
