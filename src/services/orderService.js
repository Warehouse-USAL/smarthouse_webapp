/*
|--------------------------------------------------------------------------
| ORDER SERVICE (ventas = despacho al cliente)
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, OrderController, RFC §9.4):
|   GET    /orders            params: status, from, to, vehicleId, page, size
|   GET    /orders/:id
|   POST   /orders            { items: [{ product_id, quantity }], destination_area }
|   POST   /orders/:id/cancel { reason }  (pending o in_progress → cancelled)
|
| NO confundir con RestockOrder (pedido al proveedor, restockService).
| El backend serializa en snake_case; este service traduce camelCase ↔ snake.
|
| LO QUE EL BACKEND NO TIENE:
|   · Despacho manual usado por el front: swagger SÍ declara
|     PATCH /internal/orders/{id}/status (ChangeOrderStatusRequest:
|     status + completed_at), pero la UI no lo invoca — la orden la
|     completan los rovers vía Central y el modal de despacho solo
|     informa. Pendiente de decisión de negocio (auditoría en
|     docs/auditoria-endpoints.md).
|   · Nombre de cliente: Order solo trae requested_by_user_id. La página lo
|     cruza con userService cuando el rol lo permite (requiere admin_system);
|     si no, muestra "—".
|
*/

import { apiClient } from "../lib/apiClient";
import { displayCode, fetchAllPages, fetchPage, paginate, toInstantRange } from "../lib/pagination";
import { orderMockService } from "./mocks/orderMockService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

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
    return { key: "despachado", label: "Despachado", variant: "celeste" };
  if (status === ORDER_STATUS.EN_PROCESO)
    return { key: "en_proceso", label: "En proceso", variant: "info" };
  if (status === ORDER_STATUS.CANCELADO) {
    const reason = order?.cancelReason ?? "";
    if (reason.includes("INSUFFICIENT_STOCK") || reason.includes("Stock insuficiente"))
      return { key: "falla_stock", label: "Falla por stock", variant: "danger" };
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
    code: displayCode("OC", raw.id),
  };
};

const createdAtMs = (order) => new Date(order.createdAt ?? 0).getTime();

const listByStatus = async (status) => {
  if (USE_MOCK) return (await orderMockService.list({ status })).map(normalize);
  return fetchAllPages("/orders", { status }, "orders", normalize);
};

const quantityOf = (order, productId) =>
  order.items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);

const newestFirst = (orders) =>
  [...orders].sort((a, b) => createdAtMs(b) - createdAtMs(a));

const fetchOrdersPage = (params, page, size) =>
  fetchPage("/orders", { ...params, page, size }, "orders", normalize);

/*
| GET /orders no ordena (OrderRepository.findByFilters sin Sort): el orden lo
| decide el índice que elige Mongo. Medido con el seed de 2 años: filtrando por
| `status` llega de la más nueva a la más vieja; sin `status`, en orden de
| inserción (de la más vieja a la más nueva). En el segundo caso la página N
| "más nuevas primero" se arma leyendo el listado desde el final.
*/
const fetchNewestPage = async (params, page, size) => {
  const first = await fetchOrdersPage(params, 1, size);
  const [head] = first.items;
  const tail = first.items[first.items.length - 1];
  const oldestFirst = first.items.length > 1 && createdAtMs(head) < createdAtMs(tail);
  if (!oldestFirst) {
    const result = page === 1 ? first : await fetchOrdersPage(params, page, size);
    return { ...result, items: newestFirst(result.items) };
  }

  const total = first.totalElements;
  const start = Math.max(0, total - page * size);
  const end = total - (page - 1) * size;
  if (end <= 0) return { ...first, items: [] };
  const firstChunk = Math.floor(start / size) + 1;
  const lastChunk = Math.floor((end - 1) / size) + 1;
  const chunks = await Promise.all(
    Array.from({ length: lastChunk - firstChunk + 1 }, (_, i) =>
      fetchOrdersPage(params, firstChunk + i, size)
    )
  );
  const offset = (firstChunk - 1) * size;
  const rows = chunks.flatMap((chunk) => chunk.items).slice(start - offset, end - offset);
  return { ...first, items: newestFirst(rows) };
};

export const orderService = {
  // Una página de órdenes, de la más nueva a la más vieja.
  // filters: { status, from, to, vehicleId } con from/to en yyyy-mm-dd.
  async listPage({ page = 1, size = 10, ...filters } = {}) {
    if (USE_MOCK) {
      const rows = (await orderMockService.list(filters)).map(normalize);
      return paginate(newestFirst(rows), { page, size });
    }
    return fetchNewestPage(toInstantRange(filters), page, size);
  },

  // Cuántas órdenes cumplen los filtros, sin traerlas (size=1).
  async count(filters = {}) {
    if (USE_MOCK) return (await orderMockService.list(filters)).length;
    const { totalElements } = await fetchOrdersPage(toInstantRange(filters), 1, 1);
    return totalElements;
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

  // Tras una reducción manual: las in_progress consumen stock primero y se
  // respetan; las pending se recorren de la más vieja a la más nueva y la que
  // no entra completa con lo que queda se cancela con `reason`, que debe
  // empezar con INSUFFICIENT_STOCK para que mapOrderStatus la muestre como
  // falla por stock. Devuelve las canceladas y las que el backend rechazó
  // (p. ej. 409 si se completaron entre el listado y la cancelación).
  async failShortOfStock({ productId, physicalStock, reason }) {
    const [inProgress, pending] = await Promise.all([
      listByStatus(ORDER_STATUS.EN_PROCESO),
      listByStatus(ORDER_STATUS.PENDIENTE),
    ]);
    let remaining =
      physicalStock -
      inProgress.reduce((sum, order) => sum + quantityOf(order, productId), 0);
    const toFail = [];
    for (const order of [...pending].sort((a, b) => createdAtMs(a) - createdAtMs(b))) {
      const quantity = quantityOf(order, productId);
      if (quantity === 0) continue;
      if (quantity <= remaining) remaining -= quantity;
      else toFail.push(order);
    }
    const results = await Promise.allSettled(
      toFail.map((order) => orderService.cancel(order.id, reason))
    );
    return {
      cancelled: results.filter((r) => r.status === "fulfilled").map((r) => r.value),
      notCancelled: toFail.filter((_, i) => results[i].status === "rejected"),
    };
  },
};
