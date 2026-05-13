import { apiClient } from "../lib/apiClient";
import { productMockService } from "./mocks/productMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" || !import.meta.env.VITE_API_BASE_URL;

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
    reorderPoint: stock.reorder_point ?? stock.reorderPoint ?? raw.reorder_point ?? raw.reorderPoint ?? 0,
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
  reorder_point: input.reorderPoint ?? 0,
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
  if (input.reorderPoint !== undefined) out.reorder_point = input.reorderPoint;
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
    if (isActive !== undefined) params.is_active = isActive;
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
};
