/*
|--------------------------------------------------------------------------
| ORDER SERVICE (ventas = despacho al cliente)
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, OrderController, RFC §9.4):
|   GET    /orders            params: status, from, to, vehicleId
|   GET    /orders/:id
|   POST   /orders            { items: [{ product_id, quantity }], destination_area }
|   POST   /orders/:id/cancel { reason }  (pending o in_progress → cancelled)
|
| NO confundir con RestockOrder (pedido al proveedor, restockService).
| El backend serializa en snake_case; este service traduce camelCase ↔ snake.
|
| LO QUE EL BACKEND NO TIENE:
|   · Despacho manual desde el front. La orden la completan los rovers vía
|     Central (in_progress → completed); no hay endpoint para marcarla
|     despachada a mano. La UI lo informa en vez de inventar la llamada.
|   · Nombre de cliente: Order solo trae requested_by_user_id. La página lo
|     cruza con userService cuando el rol lo permite (requiere admin_system);
|     si no, muestra "—".
|
*/

import { apiClient } from "../lib/apiClient";
import { orderMockService } from "./mocks/orderMockService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

const MAX_PAGE_SIZE = 50;
const MAX_PAGES = 20;

/*
| Mapeo UI de estados (sprint §11, sin cambiar backend).
| `falla` NO es estado backend: es visual derivado de cancelled + motivo.
| completed y cancelled son finales (sin transiciones de salida).
*/
export const ORDER_STATUS = {
  PENDIENTE: "pending",
  EN_PROCESO: "in_progress",
  DESPACHADO: "completed",
  CANCELADO: "cancelled",
};

export const mapOrderStatus = (order) => {
  const status = order?.status;
  if (status === ORDER_STATUS.DESPACHADO)
    return { key: "despachado", label: "Despachado", variant: "info" };
  if (status === ORDER_STATUS.EN_PROCESO)
    return { key: "en_proceso", label: "En proceso", variant: "neutral" };
  if (status === ORDER_STATUS.CANCELADO) {
    const reason = order?.cancelReason ?? "";
    if (reason.includes("INSUFFICIENT_STOCK") || reason.includes("Stock insuficiente"))
      return { key: "falla_stock", label: "Falla · stock", variant: "danger" };
    if (reason.includes("NO_VEHICLES_AVAILABLE") || reason.includes("robot"))
      return { key: "falla_robot", label: "Falla · robot", variant: "danger" };
    return { key: "cancelada", label: "Cancelada", variant: "danger" };
  }
  return { key: "pendiente", label: "Pendiente", variant: "warning" };
};

const normalizeItem = (raw) => ({
  productId: raw.product_id ?? raw.productId,
  sku: raw.sku ?? "",
  quantity: raw.quantity ?? 0,
});

const normalize = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    status: raw.status,
    requestedByUserId: raw.requested_by_user_id ?? raw.requestedByUserId ?? null,
    items: (raw.items || []).map(normalizeItem),
    destinationArea: raw.destination_area ?? raw.destinationArea ?? "",
    assignedVehicleId: raw.assigned_vehicle_id ?? raw.assignedVehicleId ?? null,
    createdAt: raw.timestamps?.created_at ?? raw.timestamps?.createdAt ?? raw.created_at ?? raw.createdAt ?? null,
    startedAt: raw.timestamps?.started_at ?? raw.timestamps?.startedAt ?? null,
    completedAt: raw.timestamps?.completed_at ?? raw.timestamps?.completedAt ?? null,
    cancelReason: raw.cancel_reason ?? raw.cancelReason ?? null,
  };
};

// Trae todas las páginas de un listado paginado del backend.
const fetchAllPages = async (url, params, key, normalizer) => {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = await apiClient.get(url, {
      params: { ...params, page, size: MAX_PAGE_SIZE },
    });
    const items = (data?.[key] || []).map(normalizer);
    out.push(...items);
    const total = data?.pagination?.total_pages ?? data?.pagination?.totalPages;
    if (items.length < MAX_PAGE_SIZE) return out;
    if (total !== undefined && page >= total - 1) return out;
  }
  throw new Error(
    `El listado ${url} supera los ${MAX_PAGES * MAX_PAGE_SIZE} registros; hay que paginar la pantalla.`
  );
};

// OC-00001, OC-00002… por orden cronológico de creación (la más vieja es la 1).
const withDisplayCodes = (orders) => {
  const chronological = [...orders].sort(
    (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
  );
  const codes = new Map();
  chronological.forEach((order, index) => {
    codes.set(order.id, `OC-${String(index + 1).padStart(5, "0")}`);
  });
  return orders.map((order) => ({ ...order, code: codes.get(order.id) }));
};

export const orderService = {
  async list(filters = {}) {
    if (USE_MOCK) {
      const rows = await orderMockService.list(filters);
      return withDisplayCodes(rows.map(normalize));
    }
    const rows = await fetchAllPages("/orders", filters, "orders", normalize);
    return withDisplayCodes(rows);
  },

  async get(id) {
    if (USE_MOCK) return normalize(await orderMockService.get(id));
    const { data } = await apiClient.get(`/orders/${id}`);
    return normalize(data?.order ?? data);
  },

  // Cancela una orden pending o in_progress. Real: existe en el backend (§9.4).
  async cancel(id, reason) {
    if (USE_MOCK) return normalize(await orderMockService.cancel(id, reason));
    const { data } = await apiClient.post(`/orders/${id}/cancel`, { reason });
    return normalize(data?.order ?? data);
  },
};
