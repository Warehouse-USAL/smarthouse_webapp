/*
|--------------------------------------------------------------------------
| PRODUCT MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste productos en localStorage. Imita la forma normalizada que
| devuelve productService (camelCase).
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "mock_products";

const SEED = [
  {
    id: "PRD-001",
    sku: "MOU-001",
    name: "Mouse inalámbrico",
    description: "Mouse óptico Bluetooth 5.0.",
    category: "Periféricos",
    imageUrl: "",
    active: true,
    createdAt: "2025-09-01T10:00:00.000Z",
    availableStock: 25,
    reservedStock: 3,
    reorderPoint: 5,
    maxQuantityPerOrder: 10,
    zone: "A",
    line: "1",
    position: "3",
    height: "2",
  },
  {
    id: "PRD-002",
    sku: "MON-014",
    name: 'Monitor 24" Full HD',
    description: "Monitor LED IPS 24 pulgadas.",
    category: "Monitores",
    imageUrl: "",
    active: true,
    createdAt: "2025-09-04T12:00:00.000Z",
    availableStock: 8,
    reservedStock: 0,
    reorderPoint: 3,
    maxQuantityPerOrder: 4,
    zone: "B",
    line: "2",
    position: "1",
    height: "1",
  },
  {
    id: "PRD-003",
    sku: "CAM-007",
    name: "Cámara IP exterior",
    description: "Cámara de vigilancia con visión nocturna.",
    category: "Cámaras",
    imageUrl: "",
    active: false,
    createdAt: "2025-09-10T09:30:00.000Z",
    availableStock: 0,
    reservedStock: 0,
    reorderPoint: 2,
    maxQuantityPerOrder: 2,
    zone: "C",
    line: "1",
    position: "5",
    height: "3",
  },
];

const readAll = () => localStore.get(KEY, null) ?? (localStore.set(KEY, SEED), SEED);

const writeAll = (list) => localStore.set(KEY, list);

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const nextId = (list) => {
  const max = list
    .map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `PRD-${String(max + 1).padStart(3, "0")}`;
};

const matches = (p, { category, search, isActive }) => {
  if (category && p.category !== category) return false;
  if (isActive !== undefined && p.active !== isActive) return false;
  if (search) {
    const q = search.toLowerCase();
    const hay = `${p.sku} ${p.name}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
};

export const productMockService = {
  async list(filters = {}) {
    await delay();
    return readAll().filter((p) => matches(p, filters));
  },

  async get(id) {
    await delay();
    return readAll().find((p) => p.id === id) || null;
  },

  async create(input) {
    await delay();
    const list = readAll();
    if (list.some((p) => p.sku === input.sku)) {
      throw {
        response: { data: { error: { message: "Ya existe un producto con ese SKU." } } },
      };
    }
    const created = {
      id: nextId(list),
      sku: input.sku,
      name: input.name,
      description: input.description ?? "",
      category: input.category,
      imageUrl: input.imageUrl ?? "",
      active: true,
      createdAt: new Date().toISOString(),
      availableStock: Number(input.availableStock) || 0,
      reservedStock: 0,
      reorderPoint: Number(input.reorderPoint) || 0,
      maxQuantityPerOrder: Number(input.maxQuantityPerOrder) || 0,
      zone: input.zone || "",
      line: input.line || "",
      position: input.position || "",
      height: input.height || "",
    };
    writeAll([...list, created]);
    return created;
  },

  async update(id, patch) {
    await delay();
    const list = readAll();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw { response: { data: { error: { message: "Producto no encontrado." } } } };
    }
    const updated = { ...list[idx], ...patch };
    const next = [...list];
    next[idx] = updated;
    writeAll(next);
    return updated;
  },

  async remove(id) {
    await delay();
    const list = readAll();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) {
      throw { response: { data: { error: { message: "Producto no encontrado." } } } };
    }
    writeAll(next);
  },
};
