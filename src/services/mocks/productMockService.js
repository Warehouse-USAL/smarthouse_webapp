/*
|--------------------------------------------------------------------------
| PRODUCT MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste productos en localStorage. Imita la forma normalizada que
| devuelve productService (camelCase) — Hito 2:
|   {
|     id, sku, name, description, category, imageUrl, active, createdAt,
|     availableStock, reservedStock, minimumStock, maxQuantityPerOrder,
|     unitsPerPallet, unitsPerHalfPallet, unitsPerBox,
|     location: { zone, line, position } | null
|   }
|
| Hito 2:
| - Al crear: stock = 0, sin ubicación.
| - 3 capacidades por unidad de almacenamiento (pallet / medio pallet / caja).
| - Sin altura.
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
    availableStock: 0,
    reservedStock: 0,
    minimumStock: 5,
    maxQuantityPerOrder: 10,
    unitsPerPallet: 480,
    unitsPerHalfPallet: 240,
    unitsPerBox: 24,
    location: null,
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
    availableStock: 0,
    reservedStock: 0,
    minimumStock: 3,
    maxQuantityPerOrder: 4,
    unitsPerPallet: 30,
    unitsPerHalfPallet: 15,
    unitsPerBox: 1,
    location: null,
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
    minimumStock: 2,
    maxQuantityPerOrder: 2,
    unitsPerPallet: 200,
    unitsPerHalfPallet: 100,
    unitsPerBox: 10,
    location: null,
  },
];

// Detecta entradas con shape Hito 1 o intermedio (storage_unit, height, etc.).
const isLegacyProduct = (p) =>
  p &&
  ("height" in p ||
    "zone" in p ||
    "storageUnit" in p ||
    "storageCapacityPerPosition" in p ||
    (p.location && ("idZone" in p.location || "height" in p.location)));

const readAll = () => {
  const raw = localStore.get(KEY, null);
  if (!raw || !Array.isArray(raw) || raw.some(isLegacyProduct)) {
    localStore.set(KEY, SEED);
    return SEED;
  }
  return raw;
};

const writeAll = (list) => localStore.set(KEY, list);

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

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
        response: {
          data: { error: { code: "SKU_ALREADY_EXISTS", message: "Ya existe un producto con ese SKU." } },
        },
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
      // Hito 2 §5: el producto se crea con stock = 0 y sin ubicación.
      availableStock: 0,
      reservedStock: 0,
      minimumStock: Number(input.minimumStock) || 0,
      maxQuantityPerOrder: Number(input.maxQuantityPerOrder) || 0,
      unitsPerPallet: Number(input.unitsPerPallet) || 0,
      unitsPerHalfPallet: Number(input.unitsPerHalfPallet) || 0,
      unitsPerBox: Number(input.unitsPerBox) || 0,
      location: null,
    };
    writeAll([...list, created]);
    return created;
  },

  async update(id, patch) {
    await delay();
    const list = readAll();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw {
        response: { data: { error: { code: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." } } },
      };
    }
    const current = list[idx];
    const next = { ...current, ...patch };
    // Normalizar location: si vienen los tres vacíos, dejarla en null.
    if (patch.zone !== undefined || patch.line !== undefined || patch.position !== undefined) {
      const zone = patch.zone ?? current.location?.zone ?? "";
      const line = patch.line ?? current.location?.line ?? "";
      const position = patch.position ?? current.location?.position ?? "";
      next.location = zone || line || position ? { zone, line, position } : null;
      delete next.zone;
      delete next.line;
      delete next.position;
    }
    const updated = [...list];
    updated[idx] = next;
    writeAll(updated);
    return next;
  },

  async remove(id) {
    await delay();
    const list = readAll();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw {
        response: { data: { error: { code: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." } } },
      };
    }
    // En mock hacemos baja dura para que la UX coincida con la expectativa
    // del usuario (el producto desaparece de la lista). El backend real hace
    // soft delete (active=false) — ese comportamiento queda en productService
    // contra backend, no acá.
    writeAll(list.filter((p) => p.id !== id));
  },
};
