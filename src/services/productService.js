import { apiClient } from "../lib/apiClient";
import { productMockService } from "./mocks/productMockService";
import { warehouseConfigMockService } from "./mocks/warehouseConfigMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" || !import.meta.env.VITE_API_BASE_URL;

/*
| Normalización del shape del backend (Jackson SNAKE_CASE) al shape que usa la UI.
|
| Backend devuelve:
|   {
|     id, sku, name, description, category, image_url,
|     stock: { available, reserved, minimum_stock },
|     order_constraints: { max_quantity_per_order },
|     location: { zone, line, position, height },
|     active, created_at
|   }
*/
const normalize = (raw) => {
  if (!raw) return raw;
  const stock = raw.stock || {};
  const location = raw.location || {};
  const orderConstraints = raw.order_constraints || raw.orderConstraints || {};
  return {
    id: raw.id,
    sku: raw.sku,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    imageUrl: raw.image_url ?? raw.imageUrl ?? "",
    active: raw.active,
    createdAt: raw.created_at ?? raw.createdAt,
    availableStock: stock.available ?? 0,
    reservedStock: stock.reserved ?? 0,
    minimumStock: stock.minimum_stock ?? stock.minimumStock ?? 0,
    maxQuantityPerOrder:
      orderConstraints.max_quantity_per_order ?? orderConstraints.maxQuantityPerOrder ?? 0,
    zone: location.zone || "",
    line: location.line || "",
    position: location.position || "",
    height: location.height || "",
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
  zone: input.zone || null,
  line: input.line || null,
  position: input.position || null,
  height: input.height || null,
});

const toUpdatePayload = (input) => {
  const out = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.description = input.description;
  if (input.category !== undefined) out.category = input.category;
  if (input.imageUrl !== undefined) out.image_url = input.imageUrl;
  if (input.availableStock !== undefined) out.available_stock = input.availableStock;
  if (input.minimumStock !== undefined) out.minimum_stock = input.minimumStock;
  if (input.maxQuantityPerOrder !== undefined) out.max_quantity_per_order = input.maxQuantityPerOrder;
  if (input.zone !== undefined) out.zone = input.zone;
  if (input.line !== undefined) out.line = input.line;
  if (input.position !== undefined) out.position = input.position;
  if (input.height !== undefined) out.height = input.height;
  return out;
};

export const productService = {
  async list({ category, search, isActive } = {}) {
    if (USE_MOCK) return productMockService.list({ category, search, isActive });
    const params = {};
    if (category) params.category = category;
    if (search) params.search = search;
    // Spring MVC mapea el query param por nombre de parámetro Java (no por
    // propertyNamingStrategy), así que va camelCase: ?isActive=...
    if (isActive !== undefined) params.isActive = isActive;
    const { data } = await apiClient.get("/products", { params });
    return (data?.products || []).map(normalize);
  },

  async get(id) {
    if (USE_MOCK) return productMockService.get(id);
    const { data } = await apiClient.get(`/products/${id}`);
    return normalize(data?.product);
  },

  async create(input) {
    if (USE_MOCK) return productMockService.create(input);
    const { data } = await apiClient.post("/products", toCreatePayload(input));
    return normalize(data?.product);
  },

  async update(id, patch) {
    if (USE_MOCK) return productMockService.update(id, patch);
    const { data } = await apiClient.patch(`/products/${id}`, toUpdatePayload(patch));
    return normalize(data?.product);
  },

  async remove(id) {
    if (USE_MOCK) return productMockService.remove(id);
    await apiClient.delete(`/products/${id}`);
  },

  /*
  | Asigna o limpia la ubicación física de un producto.
  |
  | En el backend real esto NO es un endpoint dedicado; usamos el PATCH
  | /products/:id general con los campos location.zone/line/position. Para
  | "limpiar" la ubicación, pasar { zone: "", line: "", position: "" }.
  |
  | El warehouseConfigMockService persiste la asignación inversa (a nivel de
  | posición) para que el panel del warehouse pueda mostrar el producto
  | asignado en modo mock. Cuando se prenda el backend, la asignación inversa
  | la sirve directamente GET /warehouse/positions/:id_position.
  */
  async assignLocation(idProduct, { zone, line, position }) {
    const next = await this.update(idProduct, {
      zone: zone || "",
      line: line != null ? String(line) : "",
      position: position || "",
    });
    if (USE_MOCK && position) {
      // Sincronizar el lado del warehouse en modo mock para que el panel
      // muestre el producto asignado. En producción este paso lo hace el back.
      await warehouseConfigMockService.setAssignedProduct(position, {
        id: next.id,
        sku: next.sku,
        name: next.name,
      });
    }
    return next;
  },
};
