/*
|--------------------------------------------------------------------------
| RESTOCK SERVICE
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, RFC_Restock_Recepcion.md):
|
|   POST   /restock/orders          { product_id, quantity_requested, supplier }
|   GET    /restock/orders          params: productId, supplier, from, to, page, size
|                                    (ordena por created_at desc)
|   GET    /restock/orders/:id      → + quantity_received_so_far
|   POST   /restock/receptions      { restock_order_id?, product_id, quantity_received,
|                                     delivery_unit, supplier, assignments[] }
|   GET    /restock/receptions      params: productId, restockOrderId, from, to, page, size
|   GET    /restock/receptions/:id
|
| Dos fuentes de sugerencia (RFC Métricas, ya mergeado — verificado en Swagger):
|
|   product.restock (corrida diaria)     sin request extra, primera opción
|   POST   /metrics/restock-suggestions  simulación en vivo con RESTOCK_PARAMS
|
| Sin ninguna de las dos, la columna "Sugerencia" queda vacía y la cantidad se
| escribe a mano — no se inventa ningún número.
|
| PENDIENTE DE UBICACIÓN (verificado en Swagger):

|   POST   /restock/receptions con assignments opcional
|   PATCH  /restock/receptions/:id
|          remito guardado sin ubicar (status PENDING_LOCATION) y asignación
|          de posiciones posterior.
|
| Dos conceptos, dos reglas (RN-03 / RN-04):
|   - RestockOrder  = pedido al proveedor. NO toca stock.
|   - Reception     = remito de lo efectivamente recibido. Es la ÚNICA vía que
|                     incrementa stock, repartiéndolo entre posiciones.
|
| LO QUE EL BACKEND NO TIENE (y cómo se resuelve acá):
|
|   · `status` en RestockOrder. El RFC §9 lo deja explícitamente fuera del hito
|     ("Hoy no hay campo status"). El estado se DERIVA comparando lo solicitado
|     contra lo recibido — el mismo proxy que propone el RFC:
|         recibido == 0                → pendiente
|         0 < recibido < solicitado    → recibido parcial
|         recibido >= solicitado       → recibido
|     "Cancelado" no existe en el backend: no se puede llegar a ese estado, así
|     que la UI no lo ofrece.
|
|   · Número de orden legible. Se deriva del id (`displayCode`): con dos años
|     de historial el listado completo ya no se descarga, así que no hay orden
|     cronológico global del cual sacar un correlativo.
|
|   · `quantity_received_so_far` solo viene en el DETALLE (GET /restock/orders/:id).
|     Para pintar "Recibido" se traen las recepciones de cada orden de la página
|     (GET /restock/receptions?restockOrderId) y se agregan en el front. De paso
|     eso da la "unidad de entrega", que vive en la Reception y no en la orden.
|
| El backend serializa en snake_case (JacksonConfig SNAKE_CASE). Este service es
| el único dueño de la traducción camelCase (UI) ↔ snake_case (cable).
|
*/

import { apiClient } from "../lib/apiClient";
import {
  daysAgo,
  displayCode,
  fetchAllPages,
  fetchPage,
  toInstantRange,
} from "../lib/pagination";
import {
  fromStoredRestock,
  fromSuggestionRow,
  toRestockAlert,
} from "../lib/restockSuggestion";


// Una orden de restock vieja casi seguro ya se recibió; las abiertas que ofrece
// el remito se buscan solo en esta ventana para no recorrer dos años de historial.
const OPEN_ORDERS_WINDOW_DAYS = 90;

/*
|--------------------------------------------------------------------------
| ESTADOS DERIVADOS
|--------------------------------------------------------------------------
*/

export const ORDER_STATUS = {
  PENDIENTE: "pendiente",
  RECIBIDO_PARCIAL: "recibido_parcial",
  RECIBIDO: "recibido",
  // Solo lo manda el backend (`status: CANCELLED`); nunca se deriva.
  CANCELADO: "cancelado",
};

// Estado de un REMITO (no de la orden). Lo persiste el backend a partir de la
// rama feature/117-recepcion-sin-ubicacion: un remito guardado sin ubicar toda
// la mercadería queda PENDING_LOCATION hasta que se le asignen las posiciones.
export const RECEPTION_STATUS = {
  PENDING_LOCATION: "PENDING_LOCATION",
  COMPLETED: "COMPLETED",
};

// Origen de un pendiente de ubicación. RELOCATION lo crea el backend al quitar
// un producto de una posición con stock (pedido en docs/nuevos_requisitos.md,
// sección 4); hasta entonces todo llega como SUPPLIER (un remito).
export const RECEPTION_TYPE = {
  SUPPLIER: "SUPPLIER",
  RELOCATION: "RELOCATION",
};

export const deriveStatus = (quantityRequested, quantityReceived) => {
  if (!quantityReceived) return ORDER_STATUS.PENDIENTE;
  if (quantityReceived < quantityRequested) return ORDER_STATUS.RECIBIDO_PARCIAL;
  return ORDER_STATUS.RECIBIDO;
};

/*
|--------------------------------------------------------------------------
| NORMALIZERS
|--------------------------------------------------------------------------
*/

const normalizeOrder = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    productId: raw.product_id ?? raw.productId,
    quantityRequested: raw.quantity_requested ?? raw.quantityRequested ?? 0,
    // Solo viene en el detalle; en el listado se completa agregando recepciones.
    quantityReceivedSoFar:
      raw.quantity_received_so_far ?? raw.quantityReceivedSoFar ?? null,
    supplier: raw.supplier ?? "",
    requestedByUserId: raw.requested_by_user_id ?? raw.requestedByUserId ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    // Campos aditivos del backend nuevo; con el viejo quedan en null/false.
    cancelled: raw.status === "CANCELLED",
    expectedDeliveryDate: raw.expected_delivery_date ?? raw.expectedDeliveryDate ?? null,
    deliveryLeadTimeDays: raw.delivery_lead_time_days ?? raw.deliveryLeadTimeDays ?? null,
    cancelledAt: raw.cancelled_at ?? raw.cancelledAt ?? null,
    cancelledByUserId: raw.cancelled_by_user_id ?? raw.cancelledByUserId ?? null,
    cancellationReason: raw.cancellation_reason ?? raw.cancellationReason ?? null,
    code: restockOrderCode(raw.id),
  };
};

export const restockOrderCode = (id) => displayCode("RST", id);

const normalizeReception = (raw) => {
  if (!raw) return null;
  const assignments = (raw.assignments || []).map((a) => ({
    positionId: a.position_id ?? a.positionId,
    quantity: a.quantity ?? 0,
  }));
  const quantityReceived = raw.quantity_received ?? raw.quantityReceived ?? 0;
  const quantityLocated = assignments.reduce((sum, a) => sum + a.quantity, 0);
  return {
    id: raw.id,
    restockOrderId: raw.restock_order_id ?? raw.restockOrderId ?? null,
    type: raw.type ?? RECEPTION_TYPE.SUPPLIER,
    productId: raw.product_id ?? raw.productId,
    quantityReceived,
    deliveryUnit: raw.delivery_unit ?? raw.deliveryUnit ?? null,
    supplier: raw.supplier ?? "",
    assignments,
    // Cuánto de lo recibido ya tiene posición y cuánto falta ubicar.
    quantityLocated,
    quantityPendingLocation: Math.max(0, quantityReceived - quantityLocated),
    // El backend viejo no manda `status`: ahí todo remito está por definición
    // completo, porque no podía guardarse sin ubicar.
    status: raw.status ?? raw.reception_status ?? RECEPTION_STATUS.COMPLETED,
    receivedByUserId: raw.received_by_user_id ?? raw.receivedByUserId ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
  };
};

/*
|--------------------------------------------------------------------------
| PAYLOAD BUILDERS
|--------------------------------------------------------------------------
*/

const toCreateOrderPayload = (input) => ({
  product_id: input.productId,
  quantity_requested: Number(input.quantityRequested) || 0,
  supplier: input.supplier,
});

const toAssignmentsPayload = (assignments = []) =>
  assignments.map((a) => ({
    position_id: a.positionId,
    quantity: Number(a.quantity) || 0,
  }));

const toCreateReceptionPayload = (input) => ({
  // Opcional: una recepción puede llegar sin orden previa (RFC §4.2).
  ...(input.restockOrderId ? { restock_order_id: input.restockOrderId } : {}),
  product_id: input.productId,
  quantity_received: Number(input.quantityReceived) || 0,
  delivery_unit: input.deliveryUnit,
  supplier: input.supplier,
  // Vacío desde el modal de remito: nace PENDING_LOCATION y se ubica después
  // desde Asignación de stock (assignReceptionPositions).
  assignments: toAssignmentsPayload(input.assignments),
});

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

// Órdenes + progreso de recepción + estado derivado. `receptions` tiene que
// incluir todas las de esas órdenes.
const withProgress = (orders, receptions) => {
  const byOrder = new Map();
  for (const reception of receptions) {
    if (!reception.restockOrderId) continue;
    const acc = byOrder.get(reception.restockOrderId) ?? {
      received: 0,
      deliveryUnits: new Set(),
      receptions: [],
    };
    acc.received += reception.quantityReceived;
    if (reception.deliveryUnit) acc.deliveryUnits.add(reception.deliveryUnit);
    acc.receptions.push(reception);
    byOrder.set(reception.restockOrderId, acc);
  }

  return orders.map((order) => {
    const progress = byOrder.get(order.id);
    const received = progress?.received ?? 0;
    return {
      ...order,
      quantityReceived: received,
      // Varias recepciones pueden llegar en unidades distintas; se muestra
      // la única si hay una sola, y "Mixta" si el remito vino partido.
      deliveryUnit:
        progress && progress.deliveryUnits.size === 1
          ? [...progress.deliveryUnits][0]
          : progress && progress.deliveryUnits.size > 1
            ? "MIXTA"
            : null,
      receptions: progress?.receptions ?? [],
      // CANCELLED lo decide el backend; el resto se sigue derivando de lo recibido.
      status: order.cancelled
        ? ORDER_STATUS.CANCELADO
        : deriveStatus(order.quantityRequested, received),
    };
  });
};

/*
|--------------------------------------------------------------------------
| SUGERENCIAS DE REESTOCK (POST /metrics/restock-suggestions)
|--------------------------------------------------------------------------
|
| El contrato NO tiene defaults: "Every param is required — each team sends its
| own business decisions". Estos son los de nuestro equipo; son parámetros de
| negocio, no una fórmula: el cálculo entero lo hace el backend.
|
|   alpha           peso de la demanda reciente contra la histórica (0–1)
|   recent_days     ventana corta
|   long_days       ventana larga (excluye la corta para no contar dos veces)
|   safety_days     colchón de seguridad, en días de demanda histórica
|   lead_time_days  lo que tarda en llegar una reposición
|   coverage_days   días de stock que se quieren tener después de reponer
|
| Cambiarlos cambia las sugerencias de toda la pantalla, que es exactamente la
| intención del contrato: son la política de reposición del depósito.
*/
// Nombre y ruta de la métrica en el catálogo del backend
// (MetricsController.RESTOCK_SUGGESTIONS).
const SUGGESTIONS_METRIC = "restock_suggestions";
const SUGGESTIONS_PATH = "/metrics/restock-suggestions";

// undefined = no se preguntó todavía; null = el backend no la tiene.
let suggestionsMetric;

export const RESTOCK_PARAMS = {
  alpha: 0.3,
  recentDays: 7,
  longDays: 60,
  safetyDays: 2,
  leadTimeDays: 5,
  coverageDays: 7,
};

const toSuggestionsPayload = (params, filters) => ({
  params: {
    alpha: params.alpha,
    recent_days: params.recentDays,
    long_days: params.longDays,
    safety_days: params.safetyDays,
    lead_time_days: params.leadTimeDays,
    coverage_days: params.coverageDays,
  },
  filters: {
    ...(filters?.productIds?.length ? { product_ids: filters.productIds } : {}),
    ...(filters?.category ? { category: filters.category } : {}),
  },
});

const normalizeSuggestionRow = (raw) => ({
  productId: raw.product_id ?? raw.productId,
  sku: raw.sku,
  name: raw.name,
  longTermDemand: raw.long_term_demand ?? raw.longTermDemand ?? 0,
  recentDemand: raw.recent_demand ?? raw.recentDemand ?? 0,
  blendedDemand: raw.blended_demand ?? raw.blendedDemand ?? 0,
  safetyStock: raw.safety_stock ?? raw.safetyStock ?? 0,
  reorderPoint: raw.reorder_point ?? raw.reorderPoint ?? 0,
  targetStock: raw.target_stock ?? raw.targetStock ?? 0,
  availableStock: raw.available_stock ?? raw.availableStock ?? 0,
  onOrderStock: raw.on_order_stock ?? raw.onOrderStock ?? 0,
  inventoryPosition: raw.inventory_position ?? raw.inventoryPosition ?? 0,
  shouldRestock: raw.should_restock ?? raw.shouldRestock ?? false,
  suggestedQuantity: raw.suggested_quantity ?? raw.suggestedQuantity ?? 0,
});

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

export const restockService = {
  /* ---------- Órdenes de restock ---------- */

  // Listado acotado (fetchAllPages): pasar siempre un rango de fechas o un
  // producto. Para la tabla usar listOrdersPage.
  async listOrders(filters = {}) {
    return fetchAllPages(
      "/restock/orders",
      toInstantRange(filters),
      "restock_orders",
      normalizeOrder
    );
  },

  // Una página de órdenes (más nuevas primero) con su progreso de recepción.
  // filters: { productId, supplier, from, to } con from/to en yyyy-mm-dd.
  async listOrdersPage({ page = 1, size = 10, ...filters } = {}) {
    const result = await fetchPage(
      "/restock/orders",
      { ...toInstantRange(filters), page, size },
      "restock_orders",
      normalizeOrder
    );
    const receptions = await Promise.all(
      result.items.map((order) => this.listReceptions({ restockOrderId: order.id }))
    );
    return { ...result, items: withProgress(result.items, receptions.flat()) };
  },

  // Órdenes que todavía esperan mercadería, para asociarles un remito. Las
  // recepciones de una orden son posteriores a ella, así que alcanza con pedir
  // las dos cosas en la misma ventana.
  async listOpenOrders() {
    const recent = { from: daysAgo(OPEN_ORDERS_WINDOW_DAYS) };
    const [orders, receptions] = await Promise.all([
      this.listOrders(recent),
      this.listReceptions(recent),
    ]);
    return withProgress(orders, receptions).filter(
      (order) =>
        order.status !== ORDER_STATUS.RECIBIDO && order.status !== ORDER_STATUS.CANCELADO
    );
  },

  async getOrder(id) {
    const { data } = await apiClient.get(`/restock/orders/${id}`);
    return normalizeOrder(data?.restock_order ?? data);
  },

  // input: { productId, quantityRequested, supplier }
  async createOrder(input) {
    const { data } = await apiClient.post("/restock/orders", toCreateOrderPayload(input));
    return normalizeOrder(data?.restock_order ?? data);
  },

  // Cancela una orden de restock: POST /restock/orders/:id/cancel { reason }.
  // 409 RESTOCK_ORDER_ALREADY_CANCELLED / RESTOCK_ORDER_HAS_RECEPTIONS; contra
  // un backend sin el endpoint responde 404.
  async cancelOrder(id, reason) {
    const { data } = await apiClient.post(`/restock/orders/${id}/cancel`, {
      reason,
    });
    return normalizeOrder(data?.restock_order ?? data);
  },

  /* ---------- Remitos de recepción ---------- */

  // filters admite `status` (PENDING_LOCATION | COMPLETED) desde la rama
  // feature/117; el backend viejo ignora el parámetro que no conoce.
  async listReceptions(filters = {}) {
    return fetchAllPages(
      "/restock/receptions",
      toInstantRange(filters),
      "receptions",
      normalizeReception
    );
  },

  async getReception(id) {
    const { data } = await apiClient.get(`/restock/receptions/${id}`);
    return normalizeReception(data?.reception ?? data);
  },

  // input: { restockOrderId?, productId, quantityReceived, deliveryUnit,
  //          supplier, assignments: [{ positionId, quantity }] }
  // El backend valida sum(assignments.quantity) === quantityReceived (RN-07).
  async createReception(input) {
    const { data } = await apiClient.post(
      "/restock/receptions",
      toCreateReceptionPayload(input)
    );
    return normalizeReception(data?.reception ?? data);
  },

  /* ---------- Sugerencias (endpoint de métricas) ---------- */

  // ¿El backend desplegado tiene la métrica? Se pregunta al catálogo, que
  // existe en las dos versiones: la nueva agrega `computed_metrics`.
  //
  // NO se descubre "probando" POST /metrics/restock-suggestions: contra un
  // backend sin esa ruta, Spring Security la rechaza con 401 antes de rutear, y
  // el interceptor de apiClient borra la sesión ante cualquier 401 — sondear
  // deslogearía al usuario.
  async findSuggestionsMetric() {
    if (suggestionsMetric !== undefined) return suggestionsMetric;
    try {
      const { data } = await apiClient.get("/metrics/catalog");
      const computed = data?.computed_metrics ?? data?.computedMetrics ?? [];
      suggestionsMetric =
        computed.find((m) => (m.name ?? m.metric) === SUGGESTIONS_METRIC) ?? null;
    } catch {
      suggestionsMetric = null;
    }
    return suggestionsMetric;
  },

  // Devuelve [{ ...fila del backend }] o null si la métrica todavía no está en
  // el backend desplegado. null ≠ [] a propósito: vacío es "no hay nada que
  // reponer", null es "no lo sabemos". La UI muestra cosas distintas.
  async listSuggestions({ params = RESTOCK_PARAMS, filters } = {}) {
    const metric = await this.findSuggestionsMetric();
    if (!metric) return null;
    const { data } = await apiClient.post(
      metric.path || SUGGESTIONS_PATH,
      toSuggestionsPayload(params, filters)
    );
    return (data?.data || []).map(normalizeSuggestionRow);
  },

  // Cruza las sugerencias con los productos ya cargados y devuelve las filas de
  // alerta, en el orden de urgencia que definió el backend. Cadena de fuentes:
  // 1) `restock` guardado por la corrida diaria (viene en GET /products, sin
  //    request extra); 2) simulación en vivo (POST); 3) null si no hay ninguna.
  // null ≠ [] a propósito: vacío es "no hay nada que reponer", null es "no lo
  // sabemos". La UI muestra cosas distintas.
  async listAlerts(products = []) {
    const stored = products
      .map((product) => fromStoredRestock(product))
      .filter(Boolean)
      .sort((a, b) => a.criticality - b.criticality);
    if (stored.length > 0) return stored;
    const rows = await this.listSuggestions();
    if (rows === null) return null;
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows
      .filter((row) => row.shouldRestock)
      .map((row) => fromSuggestionRow(row, byId.get(row.productId)));
  },

  // Alerta de un solo producto (botón de restock en Productos), con la misma
  // cadena que listAlerts para que la sugerida coincida con Gestión de stock:
  // `restock` guardado si la corrida diaria ya lo calculó; si no, simulación en
  // vivo filtrada a ese producto; si no hay ninguna, sin cantidad sugerida.
  async alertFor(product) {
    if (product.restock) return fromStoredRestock(product) ?? toRestockAlert(product);
    const rows = await this.listSuggestions({ filters: { productIds: [product.id] } });
    const row = rows?.find((r) => r.productId === product.id && r.shouldRestock);
    return row ? fromSuggestionRow(row, product) : toRestockAlert(product);
  },

  /* ---------- Ubicación diferida de un remito ---------- */

  // Remitos que todavía tienen mercadería sin posición. El backend filtra por
  // `status` desde feature/117; el viejo ignora el parámetro, pero ahí todas
  // las recepciones se normalizan como COMPLETED y el filtro local las descarta.
  async listPendingLocation() {
    const receptions = await this.listReceptions({
      status: RECEPTION_STATUS.PENDING_LOCATION,
    });
    return receptions.filter(
      (r) =>
        r.status === RECEPTION_STATUS.PENDING_LOCATION &&
        r.quantityPendingLocation > 0
    );
  },

  // Asigna posiciones a un remito que quedó en PENDING_LOCATION.
  // PATCH /restock/receptions/:id (rama feature/117-recepcion-sin-ubicacion).
  // Es incremental: se puede ubicar por partes hasta completar lo recibido.
  async assignReceptionPositions(id, assignments) {
    const { data } = await apiClient.patch(`/restock/receptions/${id}`, {
      assignments: toAssignmentsPayload(assignments),
    });
    return normalizeReception(data?.reception ?? data);
  },
};
