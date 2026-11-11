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
|   POST   /users                 CreateUserRequest { email, name, role, initial_password, supplier? }
|   PATCH  /users/:id             UpdateUserRequest  { name?, role?, active?, supplier? }   ← modificación
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
|   403 PROVIDER_WITHOUT_SUPPLIER (PROVIDER sin proveedor en restock/recepción)
|
*/

import { apiClient } from "../lib/apiClient";
import { fetchAllPages } from "../lib/pagination";

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
    // Campo aditivo del backend nuevo; con el viejo queda null.
    supplier: raw.supplier ?? null,
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

    const params = { page, size };
    if (role) params.role = role;
    if (isActive !== undefined && isActive !== "") params.isActive = isActive;

    const { data } = await apiClient.get("/users", { params });
    return {
      users: (data?.users || []).map(normalize),
      pagination: normalizePagination(data?.pagination, size),
    };
  },

  // Todos los usuarios (hasta el tope de fetchAllPages), para resolver nombres
  // a partir de ids. El backend recorta `size` a 50 por página.
  async listAll() {
    return fetchAllPages("/users", {}, "users", normalize);
  },

  async get(id) {
    const { data } = await apiClient.get(`/users/${id}`);
    return normalize(data);
  },

  async create({ email, name, role, initialPassword, supplier }) {
    const { data } = await apiClient.post("/users", {
      email,
      name,
      role,
      initial_password: initialPassword,
      ...(supplier ? { supplier } : {}),
    });
    return normalize(data);
  },

  // PATCH parcial: solo se mandan los campos presentes. El backend ignora los
  // null/ausentes y deja el valor previo (UpdateUserRequest).
  async update(id, { name, role, active, supplier } = {}) {
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (role !== undefined) payload.role = role;
    if (active !== undefined) payload.active = active;
    if (supplier !== undefined) payload.supplier = supplier;
    const { data } = await apiClient.patch(`/users/${id}`, payload);
    return normalize(data);
  },

  // Reset administrativo (no requiere la contraseña anterior). Responde 204.
  async resetPassword(id, newPassword) {
    await apiClient.post(`/users/${id}/reset-password`, { new_password: newPassword });
  },
};
