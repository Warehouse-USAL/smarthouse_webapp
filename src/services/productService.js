import { apiClient } from "../lib/apiClient";
import { localStore } from "../lib/localStore";

const META_KEY = "product_meta_by_sku";

const readMeta = () => localStore.get(META_KEY, {});

const writeMeta = (sku, patch) => {
  const all = readMeta();
  all[sku] = { ...(all[sku] || {}), ...patch };
  localStore.set(META_KEY, all);
};

const hydrate = (product) => {
  const meta = readMeta()[product.sku] || {};
  return {
    ...product,
    unitOfMeasure: meta.unitOfMeasure || "unidad",
    minStock: meta.minStock ?? 0,
  };
};

export const productService = {
  async list({ category, search, isActive } = {}) {
    const params = {};
    if (category) params.category = category;
    if (search) params.search = search;
    if (isActive !== undefined) params.isActive = isActive;
    const { data } = await apiClient.get("/products", { params });
    return (data || []).map(hydrate);
  },

  async get(id) {
    const { data } = await apiClient.get(`/products/${id}`);
    return hydrate(data);
  },

  async create({ sku, name, description, category, imageUrl, unitOfMeasure, minStock }) {
    const { data } = await apiClient.post("/products", {
      sku,
      name,
      description: description || "",
      category,
      imageUrl: imageUrl || "",
    });
    writeMeta(sku, { unitOfMeasure, minStock });
    return hydrate(data || { sku, name, category, imageUrl, availableStock: 0, reservedStock: 0, active: true });
  },

  async update(id, patch) {
    const { unitOfMeasure, minStock, sku, ...rest } = patch;
    const { data } = await apiClient.patch(`/products/${id}`, rest);
    if (sku && (unitOfMeasure !== undefined || minStock !== undefined)) {
      writeMeta(sku, { unitOfMeasure, minStock });
    }
    return hydrate(data);
  },

  async remove(id) {
    await apiClient.delete(`/products/${id}`);
  },
};
