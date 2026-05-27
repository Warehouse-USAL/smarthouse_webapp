/*
|--------------------------------------------------------------------------
| STOCK POSITION SERVICE
|--------------------------------------------------------------------------
|
| Fachada sobre la entidad StockPosicion (Hito 2 §9). Hoy el backend NO
| tiene este endpoint — el service vive en modo mock únicamente. Cuando el
| backend lo agregue, se conecta cambiando el cuerpo de cada método al
| equivalente REST:
|
|   GET    /stock-positions?productId=...&positionId=...
|   POST   /stock-positions                              // { product_id, id_position, storage_unit, quantity }
|   POST   /stock-positions/bulk                         // { entries: [...] }
|   DELETE /stock-positions/:id
|
| El shape canónico (camelCase) ya está pensado para el día que el
| backend lo exponga, así no hay que tocar la UI.
|
*/

import { apiClient } from "../lib/apiClient";
import { stockPositionMockService } from "./mocks/stockPositionMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" || !import.meta.env.VITE_API_BASE_URL;

// El backend NO tiene este endpoint todavía. Cuando lo agregue, basta con
// poner BACKEND_ENABLED en true y la UI sigue funcionando igual.
const BACKEND_ENABLED = false;

const normalize = (raw) => ({
  id: raw.id,
  productId: raw.productId ?? raw.product_id,
  idPosition: raw.idPosition ?? raw.id_position,
  storageUnit: raw.storageUnit ?? raw.storage_unit,
  quantity: raw.quantity ?? 0,
  createdAt: raw.createdAt ?? raw.created_at,
});

const toPayload = (entry) => ({
  product_id: entry.productId,
  id_position: entry.idPosition,
  storage_unit: entry.storageUnit,
  quantity: entry.quantity,
});

export const stockPositionService = {
  async list(filters = {}) {
    if (USE_MOCK || !BACKEND_ENABLED) return stockPositionMockService.list(filters);
    const params = {};
    if (filters.productId) params.product_id = filters.productId;
    if (filters.idPosition) params.id_position = filters.idPosition;
    const { data } = await apiClient.get("/stock-positions", { params });
    return (data?.stockPositions || data?.stock_positions || []).map(normalize);
  },

  async create(entry) {
    if (USE_MOCK || !BACKEND_ENABLED) return stockPositionMockService.create(entry);
    const { data } = await apiClient.post("/stock-positions", toPayload(entry));
    return normalize(data?.stockPosition ?? data);
  },

  async createMany(entries) {
    if (USE_MOCK || !BACKEND_ENABLED) return stockPositionMockService.createMany(entries);
    const { data } = await apiClient.post("/stock-positions/bulk", {
      entries: entries.map(toPayload),
    });
    return (data?.stockPositions || []).map(normalize);
  },

  async remove(id) {
    if (USE_MOCK || !BACKEND_ENABLED) return stockPositionMockService.remove(id);
    await apiClient.delete(`/stock-positions/${id}`);
  },

  // Vacía una posición completa. Devuelve el total de unidades removidas
  // para que el caller pueda descontar del availableStock del producto.
  async removeByPosition(idPosition) {
    if (USE_MOCK || !BACKEND_ENABLED) return stockPositionMockService.removeByPosition(idPosition);
    // Sin endpoint dedicado en backend: listamos, borramos uno a uno y
    // devolvemos el total.
    const list = await this.list({ idPosition });
    await Promise.all(list.map((sp) => this.remove(sp.id)));
    return list.reduce((sum, sp) => sum + (Number(sp.quantity) || 0), 0);
  },
};
