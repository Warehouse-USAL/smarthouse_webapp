/*
|--------------------------------------------------------------------------
| ORDER SERVICE (ventas = despacho al cliente)
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, OrderController, RFC §9.4):
|   GET    /orders            params: status, from, to, vehicleId, page, size
|                             (no ordena: se usa solo para contar)
|   POST   /query/orders      página ordenada en el servidor; solo campos
|                             básicos, sin los productos (items)
|   GET    /orders/:id        detalle completo, con items
|   POST   /orders            { items: [{ product_id, quantity }], destination_area }
|   POST   /orders/:id/cancel { reason }  (pending o in_progress → cancelled)
|
| NO confundir con RestockOrder (pedido al proveedor, restockService).
| El backend serializa en snake_case; este service traduce camelCase ↔ snake.
|
| LO QUE EL BACKEND NO TIENE:
|   · Despacho manual usado por el front: swagger SÍ declara
|     PATCH /internal/orders/{id}/status (ChangeOrderStatusRequest:
|     status + completed_at), pero la UI no lo invoca: el estado lo
|     cambian los otros equipos (los rovers la completan vía Central) y
|     esta app solo lo muestra.
|   · Nombre de cliente: Order solo trae requested_by_user_id. La página lo
|     cruza con userService cuando el rol lo permite (requiere admin_system);
|     si no, muestra "—".
|
*/

import { apiClient } from "../lib/apiClient";
import { displayCode, fetchAllPages, fetchPage, toInstantRange } from "../lib/pagination";

// Campos que trae una fila del listado (POST /query/orders). Los productos no
// se pueden pedir ahí: se traen con get(id) al expandir o ver el detalle.
const QUERY_FIELDS = [
  "id",
  "status",
  "created_at",
  "completed_at",
  "requested_by_user_id",
  "cancel_reason",
];


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

// Orden cancelada por el backend al reducir stock (`cancelled_orders` del
// PATCH de la posición): { id, cancel_reason, created_at }. Se arma con la
// misma forma que `normalize` para que el diálogo la muestre igual.
export const normalizeCancelledOrder = (raw) => ({
  id: raw.id,
  status: ORDER_STATUS.CANCELADO,
  cancelReason: raw.cancel_reason ?? raw.cancelReason ?? null,
  createdAt: raw.created_at ?? raw.createdAt ?? null,
  code: displayCode("OC", raw.id),
});

const createdAtMs = (order) => new Date(order.createdAt ?? 0).getTime();

const listByStatus = async (status) => {
  return fetchAllPages("/orders", { status }, "orders", normalize);
};

const quantityOf = (order, productId) =>
  order.items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);

const fetchOrdersPage = (params, page, size) =>
  fetchPage("/orders", { ...params, page, size }, "orders", normalize);

// Fila del listado: el estado llega en mayúsculas (PENDING) y se pasa al
// vocabulario de ORDER_STATUS; `items` queda en null hasta pedir el detalle.
const normalizeQueryRow = (raw) => ({
  ...normalize(raw),
  status: raw.status ? String(raw.status).toLowerCase() : raw.status,
  createdAt: raw.created_at ?? null,
  completedAt: raw.completed_at ?? null,
  items: null,
});

// Filtros de la tabla → condiciones de /query. from/to en yyyy-mm-dd.
const toQueryFilters = ({ status, from, to }) => {
  const range = toInstantRange({ from, to });
  return [
    ...(status ? [{ field: "status", op: "eq", value: status.toUpperCase() }] : []),
    ...(range.from ? [{ field: "created_at", op: "gte", value: range.from }] : []),
    ...(range.to ? [{ field: "created_at", op: "lte", value: range.to }] : []),
  ];
};

export const orderService = {
  // Una página de órdenes ordenada en el servidor (por defecto, más nuevas
  // primero). filters: { status, from, to } con from/to en yyyy-mm-dd; sort:
  // { field, dir } sobre created_at, completed_at o status. Las filas no
  // traen productos (items: null).
  async listPage({ page = 1, size = 10, sort, ...filters } = {}) {
    const { data } = await apiClient.post("/query/orders", {
      filters: toQueryFilters(filters),
      sort: [sort ?? { field: "created_at", dir: "desc" }],
      page: page - 1,
      size,
      fields: QUERY_FIELDS,
    });
    const pagination = data?.pagination ?? {};
    return {
      items: (data?.items || []).map(normalizeQueryRow),
      totalPages: pagination.total_pages ?? 0,
      totalElements: pagination.total_elements ?? 0,
    };
  },

  // Cuántas órdenes cumplen los filtros, sin traerlas (size=1).
  async count(filters = {}) {
    const { totalElements } = await fetchOrdersPage(toInstantRange(filters), 1, 1);
    return totalElements;
  },

  async get(id) {
    const { data } = await apiClient.get(`/orders/${id}`);
    return normalize(data?.order ?? data);
  },

  // Cancela una orden pending o in_progress. Real: existe en el backend (§9.4).
  async cancel(id, reason) {
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
