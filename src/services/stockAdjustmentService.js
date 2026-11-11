/*
|--------------------------------------------------------------------------
| STOCK ADJUSTMENT SERVICE
|--------------------------------------------------------------------------
|
| Historial de ajustes manuales de stock (wh-backend, StockAdjustmentController):
|
|   POST /warehouse/positions/:id/stock-adjustments   { quantity, type, reason }
|        → { adjustment, cancelled_orders }
|   GET  /warehouse/positions/:id/stock-adjustments?page&size
|        → { stock_adjustments, pagination }
|   GET  /products/:id/stock-adjustments?page&size
|        → { stock_adjustments, pagination }
|
| El front aplica los ajustes con PATCH /warehouse/positions/:id (que ya
| persiste el `reason` y devuelve `cancelled_orders`). Este service solo LEE el
| historial: es la auditoría que muestra quién ajustó, cuándo y por qué.
|
| El backend serializa en snake_case (JacksonConfig SNAKE_CASE). `adjusted_by`
| es el id del usuario que hizo el ajuste ("system" si no hubo request).
|
*/

import { fetchPage } from "../lib/pagination";


const normalizeAdjustment = (raw) => ({
  id: raw.id,
  positionId: raw.position_id ?? raw.positionId,
  productId: raw.product_id ?? raw.productId,
  type: raw.type,
  reason: raw.reason ?? null,
  quantityBefore: raw.quantity_before ?? raw.quantityBefore ?? 0,
  quantityAfter: raw.quantity_after ?? raw.quantityAfter ?? 0,
  adjustedBy: raw.adjusted_by ?? raw.adjustedBy ?? null,
  createdAt: raw.created_at ?? raw.createdAt ?? null,
  cancelledOrderIds: raw.cancelled_order_ids ?? raw.cancelledOrderIds ?? [],
});

export const stockAdjustmentService = {
  // Historial del producto cruzando todas sus posiciones, más nuevo primero.
  // page es 1-based (fetchPage lo traduce a 0-based para el backend).
  async listProductAdjustments(productId, { page = 1, size = 10 } = {}) {
    // Sin backend (modo demo) no se simulan ajustes: se devuelve vacío.
    return fetchPage(
      `/products/${productId}/stock-adjustments`,
      { page, size },
      "stock_adjustments",
      normalizeAdjustment
    );
  },
};
