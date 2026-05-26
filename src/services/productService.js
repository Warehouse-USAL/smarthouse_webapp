/*
|--------------------------------------------------------------------------
| PRODUCT SERVICE
|--------------------------------------------------------------------------
|
| Fachada sobre el catálogo de productos.
|
| Cuando VITE_USE_MOCK está activo (o no hay VITE_API_BASE_URL), delega en
| productMockService. En modo backend usa apiClient siguiendo el contrato
| REAL implementado en wh-backend (Spring Boot + Mongo):
|
|   GET    /products?category=&search=&isActive=&page=0&size=10
|   GET    /products/:id
|   POST   /products
|   PATCH  /products/:id
|   DELETE /products/:id     → 204 No Content (soft delete)
|
| El backend devuelve wrappers:
|   - GET    /products       → { products: [...], pagination: {...} }
|   - GET    /products/:id   → { product: {...} }
|   - POST   /products       → { product: {...} }
|   - PATCH  /products/:id   → { product: {...} }
|
| Shape del Product en backend (camelCase porque Spring serializa sin
| naming strategy global; los campos con @JsonProperty usan snake_case):
|   {
|     id, sku, name, description, category, imageUrl,
|     stock: { available, reserved, minimumStock },
|     orderConstraints: { maxQuantityPerOrder },
|     location: { zone, line, position, height },     // ← planos, strings
|     active, createdAt
|   }
|
| Shape normalizado que devuelve este service (lo que consume la UI):
|   {
|     id, sku, name, description, category, imageUrl, active, createdAt,
|     availableStock, reservedStock, minimumStock, maxQuantityPerOrder,
|     // Capacidades por unidad (Hito 2 — el backend NO los expone aún):
|     unitsPerPallet, unitsPerHalfPallet, unitsPerBox,
|     // Ubicación física (Hito 2 — sin height):
|     location: { zone, line, position } | null
|   }
|
| Decisiones Hito 2:
| - El front NO envía `height` al backend (queda como string vacío).
| - El front sí envía `units_per_*` en el body; el backend los ignora hoy.
|   Cuando los agregue al record, llegan transparentemente.
| - La asignación de ubicación se hace con PATCH /products/:id pasando
|   zone/line/position (no hay endpoint /location separado en el backend).
|
*/

import { apiClient } from "../lib/apiClient";
import { productMockService } from "./mocks/productMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" || !import.meta.env.VITE_API_BASE_URL;

const normalizeLocation = (raw) => {
  if (!raw) return null;
  const zone = raw.zone ?? "";
  const line = raw.line ?? "";
  const position = raw.position ?? "";
  if (!zone && !line && !position) return null;
  return { zone, line, position };
};

const normalize = (raw) => {
  if (!raw) return raw;
  const stock = raw.stock || {};
  const orderConstraints = raw.orderConstraints || raw.order_constraints || {};
  return {
    id: raw.id,
    sku: raw.sku,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    imageUrl: raw.imageUrl ?? raw.image_url ?? "",
    active: raw.active,
    createdAt: raw.createdAt ?? raw.created_at,
    availableStock: stock.available ?? raw.availableStock ?? raw.available_stock ?? 0,
    reservedStock: stock.reserved ?? raw.reservedStock ?? raw.reserved_stock ?? 0,
    minimumStock:
      stock.minimumStock ??
      stock.minimum_stock ??
      raw.minimumStock ??
      raw.minimum_stock ??
      0,
    maxQuantityPerOrder:
      orderConstraints.maxQuantityPerOrder ??
      orderConstraints.max_quantity_per_order ??
      raw.maxQuantityPerOrder ??
      raw.max_quantity_per_order ??
      0,
    // Capacidades por unidad (Hito 2). Si el backend todavía no las expone,
    // quedan en 0 y se completan desde el mock o desde el form local.
    unitsPerPallet: raw.unitsPerPallet ?? raw.units_per_pallet ?? 0,
    unitsPerHalfPallet: raw.unitsPerHalfPallet ?? raw.units_per_half_pallet ?? 0,
    unitsPerBox: raw.unitsPerBox ?? raw.units_per_box ?? 0,
    location: normalizeLocation(raw.location),
  };
};

const toCreatePayload = (input) => ({
  sku: input.sku,
  name: input.name,
  description: input.description ?? "",
  category: input.category,
  image_url: input.imageUrl ?? "",
  available_stock: input.availableStock ?? 0,
  minimum_stock: input.minimumStock ?? 0,
  max_quantity_per_order: input.maxQuantityPerOrder ?? 0,
  // Hito 2: capacidades por unidad. El backend actual ignora estos campos.
  units_per_pallet: input.unitsPerPallet ?? 0,
  units_per_half_pallet: input.unitsPerHalfPallet ?? 0,
  units_per_box: input.unitsPerBox ?? 0,
  // Ubicación: al crear, el producto NO tiene ubicación (Hito 2 §5).
  zone: "",
  line: "",
  position: "",
});

const toUpdatePayload = (input) => {
  const out = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.description = input.description;
  if (input.category !== undefined) out.category = input.category;
  if (input.imageUrl !== undefined) out.image_url = input.imageUrl;
  if (input.availableStock !== undefined) out.available_stock = input.availableStock;
  if (input.minimumStock !== undefined) out.minimum_stock = input.minimumStock;
  if (input.maxQuantityPerOrder !== undefined)
    out.max_quantity_per_order = input.maxQuantityPerOrder;
  if (input.unitsPerPallet !== undefined) out.units_per_pallet = input.unitsPerPallet;
  if (input.unitsPerHalfPallet !== undefined)
    out.units_per_half_pallet = input.unitsPerHalfPallet;
  if (input.unitsPerBox !== undefined) out.units_per_box = input.unitsPerBox;
  if (input.zone !== undefined) out.zone = input.zone;
  if (input.line !== undefined) out.line = input.line;
  if (input.position !== undefined) out.position = input.position;
  return out;
};

export const productService = {
  async list({ category, search, isActive, page = 0, size = 50 } = {}) {
    if (USE_MOCK) return productMockService.list({ category, search, isActive });
    const params = { page, size };
    if (category) params.category = category;
    if (search) params.search = search;
    if (isActive !== undefined) params.isActive = isActive;
    const { data } = await apiClient.get("/products", { params });
    return (data?.products || []).map(normalize);
  },

  async get(id) {
    if (USE_MOCK) return productMockService.get(id);
    const { data } = await apiClient.get(`/products/${id}`);
    return normalize(data?.product ?? data);
  },

  async create(input) {
    if (USE_MOCK) return productMockService.create(input);
    const { data } = await apiClient.post("/products", toCreatePayload(input));
    return normalize(data?.product ?? data);
  },

  async update(id, patch) {
    if (USE_MOCK) return productMockService.update(id, patch);
    const { data } = await apiClient.patch(`/products/${id}`, toUpdatePayload(patch));
    return normalize(data?.product ?? data);
  },

  // Asigna o limpia la ubicación física de un producto.
  // El backend NO tiene endpoint /location separado: se usa PATCH /products/:id
  // pasando zone/line/position. Para liberar, se pasan strings vacíos.
  async assignLocation(id, location) {
    return this.update(id, {
      zone: location?.zone || "",
      line: location?.line || "",
      position: location?.position || "",
    });
  },

  async remove(id) {
    if (USE_MOCK) return productMockService.remove(id);
    await apiClient.delete(`/products/${id}`);
  },
};
