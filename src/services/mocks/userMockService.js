/*
|--------------------------------------------------------------------------
| USER MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste usuarios en localStorage replicando el contrato del backend
| (UserController). Devuelve la misma forma snake_case que el backend real
| para que userService.normalize() funcione igual con mock o con backend.
|
| Reglas que copia del UserService real:
|   - createUser: email único → si ya existe tira EMAIL_ALREADY_EXISTS (409).
|   - updateUser: parcial (name/role/active), USER_NOT_FOUND si no existe.
|   - resetPassword / changeMyPassword: acá no hay hashing real, solo validamos
|     el flujo (WRONG_CURRENT_PASSWORD / SAME_PASSWORD) sobre un password plano
|     guardado solo en el mock.
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "mock_users";

const SEED = [
  {
    id: "USR-001",
    email: "admin@test.com",
    name: "Juan Pérez",
    role: "ADMIN_SALES",
    active: true,
    created_at: "2026-01-12T09:00:00Z",
    address: { street: "Av. Colón 1234", department: "B", floor: "3", postal_code: "5000" },
    _password: "1234",
  },
  {
    id: "USR-002",
    email: "sistema@test.com",
    name: "María Gómez",
    role: "ADMIN_SYSTEM",
    active: true,
    created_at: "2026-02-03T14:30:00Z",
    address: null,
    _password: "1234",
  },
  {
    id: "USR-003",
    email: "deposito@test.com",
    name: "Carlos Ruiz",
    role: "ADMIN_WAREHOUSE",
    active: true,
    created_at: "2026-02-20T11:15:00Z",
    address: null,
    _password: "1234",
  },
  {
    id: "USR-004",
    email: "operario1@test.com",
    name: "Lucía Fernández",
    role: "OPERATOR",
    active: false,
    created_at: "2026-03-08T08:45:00Z",
    address: null,
    _password: "1234",
  },
  {
    id: "USR-005",
    email: "despacho@test.com",
    name: "Diego Sosa",
    role: "DISPATCHER",
    active: true,
    created_at: "2026-04-01T16:20:00Z",
    address: null,
    _password: "1234",
  },
  {
    id: "USR-006",
    email: "proveedor@test.com",
    name: "Ana Torres",
    role: "PROVIDER",
    active: true,
    created_at: "2026-05-11T10:05:00Z",
    address: null,
    _password: "1234",
  },
];

const readAll = () => localStore.get(KEY, null) ?? (localStore.set(KEY, SEED), SEED);
const writeAll = (list) => localStore.set(KEY, list);
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const nextId = (list) => {
  const max = list
    .map((u) => parseInt(String(u.id).replace(/\D/g, ""), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `USR-${String(max + 1).padStart(3, "0")}`;
};

// El backend nunca devuelve el password; lo quitamos antes de exponer el user.
const strip = (user) => {
  const copy = { ...user };
  delete copy._password;
  return copy;
};

const httpError = (status, code) => {
  const err = new Error(code);
  err.response = { status, data: { error: { code } } };
  return err;
};

export const userMockService = {
  async list({ role, isActive, page = 0, size = 10 } = {}) {
    await delay();
    let all = readAll();
    if (role) all = all.filter((u) => u.role === role);
    if (isActive !== undefined && isActive !== "")
      all = all.filter((u) => u.active === (isActive === true || isActive === "true"));

    const total = all.length;
    const start = page * size;
    const slice = all.slice(start, start + size).map(strip);
    return {
      users: slice,
      pagination: {
        page,
        size,
        total_elements: total,
        total_pages: Math.max(1, Math.ceil(total / size)),
      },
    };
  },

  async get(id) {
    await delay(150);
    const user = readAll().find((u) => u.id === id);
    if (!user) throw httpError(404, "USER_NOT_FOUND");
    return strip(user);
  },

  async create({ email, name, role, initialPassword }) {
    await delay();
    const all = readAll();
    if (all.some((u) => u.email.toLowerCase() === String(email).toLowerCase()))
      throw httpError(409, "EMAIL_ALREADY_EXISTS");
    const user = {
      id: nextId(all),
      email,
      name,
      role,
      active: true,
      created_at: new Date().toISOString(),
      address: null,
      _password: initialPassword || "1234",
    };
    writeAll([...all, user]);
    return strip(user);
  },

  async update(id, patch) {
    await delay();
    const all = readAll();
    const idx = all.findIndex((u) => u.id === id);
    if (idx === -1) throw httpError(404, "USER_NOT_FOUND");
    const next = { ...all[idx] };
    if (patch.name !== undefined && patch.name !== null) next.name = patch.name;
    if (patch.role !== undefined && patch.role !== null) next.role = patch.role;
    if (patch.active !== undefined && patch.active !== null) next.active = patch.active;
    all[idx] = next;
    writeAll(all);
    return strip(next);
  },

  async resetPassword(id, newPassword) {
    await delay();
    const all = readAll();
    const idx = all.findIndex((u) => u.id === id);
    if (idx === -1) throw httpError(404, "USER_NOT_FOUND");
    all[idx] = { ...all[idx], _password: newPassword };
    writeAll(all);
  },
};
