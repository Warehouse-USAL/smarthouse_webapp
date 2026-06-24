/*
|--------------------------------------------------------------------------
| USER SERVICE
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, UserController) — requiere rol
| SUPERADMIN o ADMIN_SYSTEM (salvo los /me, que son self-service):
|
|   GET    /users                 params: role, isActive, page, size
|                                  → { users: [...], pagination }
|   GET    /users/:id             → UserResponse
|   POST   /users                 CreateUserRequest { email, name, role, initial_password }
|   PATCH  /users/:id             UpdateUserRequest  { name?, role?, active? }   ← modificación
|   POST   /users/:id/reset-password   { new_password }                          (204)
|   POST   /users/me/change-password   { current_password, new_password }        (self)
|   PATCH  /users/me                   { name, address }                         (self)
|
| El backend serializa en snake_case (JacksonConfig SNAKE_CASE). Este service
| es el único dueño de la traducción camelCase (UI) ↔ snake_case (cable):
|   - initial_password / new_password / current_password / postal_code.
|
| Códigos de error del backend que la UI traduce:
|   409 EMAIL_ALREADY_EXISTS · 404 USER_NOT_FOUND · 400 INVALID_ROLE
|   400 WRONG_CURRENT_PASSWORD · 400 SAME_PASSWORD
|
*/

import { apiClient } from "../lib/apiClient";
import { userMockService } from "./mocks/userMockService";

// Backend same-origin vía proxy de Vite: el único interruptor es el flag.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/*
|--------------------------------------------------------------------------
| NORMALIZER  (snake_case backend → camelCase UI)
|--------------------------------------------------------------------------
*/

const normalizeAddress = (raw) => {
  if (!raw) return null;
  return {
    street: raw.street ?? "",
    department: raw.department ?? "",
    floor: raw.floor ?? "",
    postalCode: raw.postal_code ?? raw.postalCode ?? "",
  };
};

const normalize = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    active: raw.active,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    address: normalizeAddress(raw.address),
  };
};

const normalizePagination = (raw, fallbackSize) => {
  if (!raw) return { page: 0, size: fallbackSize, totalElements: 0, totalPages: 1 };
  return {
    page: raw.page ?? 0,
    size: raw.size ?? fallbackSize,
    totalElements: raw.total_elements ?? raw.totalElements ?? 0,
    totalPages: raw.total_pages ?? raw.totalPages ?? 1,
  };
};

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

export const userService = {
  async list({ role, isActive, page = 0, size = 10 } = {}) {
    if (USE_MOCK) {
      const data = await userMockService.list({ role, isActive, page, size });
      return {
        users: (data.users || []).map(normalize),
        pagination: normalizePagination(data.pagination, size),
      };
    }

    const params = { page, size };
    if (role) params.role = role;
    if (isActive !== undefined && isActive !== "") params.isActive = isActive;

    const { data } = await apiClient.get("/users", { params });
    return {
      users: (data?.users || []).map(normalize),
      pagination: normalizePagination(data?.pagination, size),
    };
  },

  async get(id) {
    if (USE_MOCK) return normalize(await userMockService.get(id));
    const { data } = await apiClient.get(`/users/${id}`);
    return normalize(data);
  },

  async create({ email, name, role, initialPassword }) {
    if (USE_MOCK) return normalize(await userMockService.create({ email, name, role, initialPassword }));
    const { data } = await apiClient.post("/users", {
      email,
      name,
      role,
      initial_password: initialPassword,
    });
    return normalize(data);
  },

  // PATCH parcial: solo se mandan los campos presentes. El backend ignora los
  // null/ausentes y deja el valor previo (UpdateUserRequest).
  async update(id, { name, role, active } = {}) {
    if (USE_MOCK) return normalize(await userMockService.update(id, { name, role, active }));
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (role !== undefined) payload.role = role;
    if (active !== undefined) payload.active = active;
    const { data } = await apiClient.patch(`/users/${id}`, payload);
    return normalize(data);
  },

  // Reset administrativo (no requiere la contraseña anterior). Responde 204.
  async resetPassword(id, newPassword) {
    if (USE_MOCK) return userMockService.resetPassword(id, newPassword);
    await apiClient.post(`/users/${id}/reset-password`, { new_password: newPassword });
  },
};
