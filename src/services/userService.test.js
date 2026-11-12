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

describe("listAll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recorre todas las páginas de usuarios", async () => {
    const pageOf = (count, offset) =>
      Array.from({ length: count }, (_, i) => ({ id: `u${offset + i}`, name: `U${offset + i}` }));
    apiClient.get
      .mockResolvedValueOnce({ data: { users: pageOf(50, 0), pagination: { total_pages: 2 } } })
      .mockResolvedValueOnce({ data: { users: pageOf(3, 50), pagination: { total_pages: 2 } } });

    const users = await userService.listAll();

    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.get).toHaveBeenLastCalledWith("/users", { params: { page: 1, size: 50 } });
    expect(users).toHaveLength(53);
  });
});

describe("perfil propio (/users/me)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMe lee con PATCH vacío y normaliza dirección y proveedor", async () => {
    apiClient.patch.mockResolvedValue({
      data: {
        id: "u1",
        role: "PROVIDER",
        supplier: "ACME",
        address: { street: "Calle 1", department: "B", floor: "3", postal_code: "1425" },
      },
    });
    const me = await userService.getMe();
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {});
    expect(me.supplier).toBe("ACME");
    expect(me.address.postalCode).toBe("1425");
  });

  it("updateMe manda solo lo que viene, con la dirección en snake_case", async () => {
    apiClient.patch.mockResolvedValue({ data: { id: "u1" } });
    await userService.updateMe({ name: "Ana" });
    expect(apiClient.patch).toHaveBeenLastCalledWith("/users/me", { name: "Ana" });
    await userService.updateMe({
      address: { street: "Calle 1", department: "", floor: "", postalCode: "1425" },
    });
    expect(apiClient.patch).toHaveBeenLastCalledWith("/users/me", {
      address: { street: "Calle 1", department: "", floor: "", postal_code: "1425" },
    });
  });

  it("changeMyPassword manda current_password y new_password", async () => {
    apiClient.post.mockResolvedValue({});
    await userService.changeMyPassword("vieja", "nueva");
    expect(apiClient.post).toHaveBeenCalledWith("/users/me/change-password", {
      current_password: "vieja",
      new_password: "nueva",
    });
  });
});
