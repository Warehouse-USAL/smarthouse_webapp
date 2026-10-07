/*
|--------------------------------------------------------------------------
| RESTOCK SERVICE
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, RFC_Restock_Recepcion.md):
|
|   POST   /restock/orders          { product_id, quantity_requested, supplier }
|   GET    /restock/orders          params: productId, supplier, from, to, page, size
|   GET    /restock/orders/:id      → + quantity_received_so_far
|   POST   /restock/receptions      { restock_order_id?, product_id, quantity_received,
|                                     delivery_unit, supplier, assignments[] }
|   GET    /restock/receptions      params: productId, restockOrderId, from, to, page, size
|   GET    /restock/receptions/:id
|
| EN RAMAS TODAVÍA SIN MERGEAR (los clientes ya están escritos acá):
|
|   POST   /metrics/restock-suggestions        feature/metrics-endpoints
|          cuánto reponer por producto, con demanda ponderada y punto de
|          reposición. Hasta que exista, la columna "Sugerencia" queda vacía y
|          la cantidad se escribe a mano — no se inventa ningún número.
|
|   POST   /restock/receptions con assignments opcional   feature/117-...
|   PATCH  /restock/receptions/:id                        feature/117-...
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
|         0 < recibido < solicitado    → recibido (parcial)
|         recibido >= solicitado       → completado
|     "Cancelado" no existe en el backend: no se puede llegar a ese estado, así
|     que la UI no lo ofrece.
|
|   · Número de orden legible (RST-00001). El id es un ObjectId de Mongo. El
|     código se deriva del orden cronológico del listado completo (ver
|     `withDisplayCodes`), estable mientras no se borren órdenes.
|
|   · `quantity_received_so_far` solo viene en el DETALLE (GET /restock/orders/:id).
|     Para pintar la columna "Recibido" del listado sin hacer N requests, se
|     traen las recepciones (GET /restock/receptions) y se agregan por
|     restock_order_id en el front. De paso eso da la "unidad de entrega", que
|     vive en la Reception y no en la orden.
|
| El backend serializa en snake_case (JacksonConfig SNAKE_CASE). Este service es
| el único dueño de la traducción camelCase (UI) ↔ snake_case (cable).
|
*/

import { apiClient } from "../lib/apiClient";
import { fromSuggestionRow } from "../lib/restockSuggestion";
import { warehouseConfigService } from "./warehouseConfigService";
import { restockMockService } from "./mocks/restockMockService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// El backend capea `size` en 50 (PageRequest.of(..., min(size, 50))). Para los
// listados completos se pagina en bucle con este tope.
const MAX_PAGE_SIZE = 50;
const MAX_PAGES = 20; // cinturón de seguridad: 1000 registros como máximo.

/*
|--------------------------------------------------------------------------
| ESTADOS DERIVADOS
|--------------------------------------------------------------------------
*/

export const ORDER_STATUS = {
  PENDIENTE: "pendiente",
  RECIBIDO: "recibido",
  COMPLETADO: "completado",
};

// Estado de un REMITO (no de la orden). Lo persiste el backend a partir de la
// rama feature/117-recepcion-sin-ubicacion: un remito guardado sin ubicar toda
// la mercadería queda PENDING_LOCATION hasta que se le asignen las posiciones.
export const RECEPTION_STATUS = {
  PENDING_LOCATION: "PENDING_LOCATION",
  COMPLETED: "COMPLETED",
};

export const deriveStatus = (quantityRequested, quantityReceived) => {
  if (!quantityReceived) return ORDER_STATUS.PENDIENTE;
  if (quantityReceived < quantityRequested) return ORDER_STATUS.RECIBIDO;
  return ORDER_STATUS.COMPLETADO;
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
  };
};

const normalizeReception = (raw) => {
  if (!raw) return null;
  if (raw.status !== undefined || raw.reception_status !== undefined) {
    pendingLocationSupported = true;
  }
  const assignments = (raw.assignments || []).map((a) => ({
    positionId: a.position_id ?? a.positionId,
    quantity: a.quantity ?? 0,
  }));
  const quantityReceived = raw.quantity_received ?? raw.quantityReceived ?? 0;
  const quantityLocated = assignments.reduce((sum, a) => sum + a.quantity, 0);
  return {
    id: raw.id,
    restockOrderId: raw.restock_order_id ?? raw.restockOrderId ?? null,
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
  // Con la rama feature/117 `assignments` es opcional: un remito sin ubicar
  // nace PENDING_LOCATION. Contra el backend viejo es @NotEmpty, así que la UI
  // solo ofrece guardar sin ubicar cuando detecta la capacidad.
  assignments: toAssignmentsPayload(input.assignments),
});

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

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
  // Se acabaron las páginas permitidas y el backend todavía tiene más. Devolver
  // la lista igual sería peor que fallar: los totales recibidos y los códigos
  // RST-xxxxx se calculan sobre el conjunto completo, así que con datos
  // truncados saldrían mal sin que nada lo indique.
  throw new Error(
    `El listado ${url} supera los ${MAX_PAGES * MAX_PAGE_SIZE} registros; hay que paginar la pantalla.`
  );
};

// RST-00001, RST-00002… por orden cronológico de creación (la más vieja es la 1).
const withDisplayCodes = (orders) => {
  const chronological = [...orders].sort(
    (a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
  );
  const codes = new Map();
  chronological.forEach((order, index) => {
    codes.set(order.id, `RST-${String(index + 1).padStart(5, "0")}`);
  });
  return orders.map((order) => ({ ...order, code: codes.get(order.id) }));
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

/*
| ¿El backend desplegado ya maneja remitos sin ubicar?
|
| Se pregunta al catálogo de entidades (GET /query/catalog), que se autodescribe
| campo por campo y existe en las dos versiones: feature/117 agregó `status` a
| la entidad `receptions`, antes no estaba. Es la fuente confiable, porque
| responde igual con la base vacía.
|
| El fallback mira si alguna recepción trajo `status`. Sirve cuando el rol del
| usuario no ve la entidad en el catálogo (WAREHOUSE_ADMINS), pero NO alcanza
| solo: con cero recepciones nunca se prendería y el primer remito sin ubicar
| sería imposible de crear.
|
| Arranca apagado para no ofrecer "guardar sin ubicar" contra un backend que lo
| rechazaría con 400 (assignments es @NotEmpty en la versión vieja).
*/
const RECEPTIONS_ENTITY = "receptions";
const PENDING_LOCATION_FIELD = "status";

// undefined = no se preguntó; true/false = respuesta del catálogo;
// null = el catálogo no lo dice (rol sin permiso, o error de red).
let pendingLocationCapability;

// Señal secundaria: alguna recepción llegó con `status`.
let pendingLocationSupported = false;

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

  async listOrders(filters = {}) {
    if (USE_MOCK) return restockMockService.listOrders(filters);
    return fetchAllPages("/restock/orders", filters, "restock_orders", normalizeOrder);
  },

  async getOrder(id) {
    if (USE_MOCK) return restockMockService.getOrder(id);
    const { data } = await apiClient.get(`/restock/orders/${id}`);
    return normalizeOrder(data?.restock_order ?? data);
  },

  // input: { productId, quantityRequested, supplier }
  async createOrder(input) {
    if (USE_MOCK) return restockMockService.createOrder(input);
    const { data } = await apiClient.post("/restock/orders", toCreateOrderPayload(input));
    return normalizeOrder(data?.restock_order ?? data);
  },

  /* ---------- Remitos de recepción ---------- */

  // filters admite `status` (PENDING_LOCATION | COMPLETED) desde la rama
  // feature/117; el backend viejo ignora el parámetro que no conoce.
  async listReceptions(filters = {}) {
    if (USE_MOCK) return restockMockService.listReceptions(filters);
    return fetchAllPages("/restock/receptions", filters, "receptions", normalizeReception);
  },

  async getReception(id) {
    if (USE_MOCK) return restockMockService.getReception(id);
    const { data } = await apiClient.get(`/restock/receptions/${id}`);
    return normalizeReception(data?.reception ?? data);
  },

  // input: { restockOrderId?, productId, quantityReceived, deliveryUnit,
  //          supplier, assignments: [{ positionId, quantity }] }
  // El backend valida sum(assignments.quantity) === quantityReceived (RN-07).
  async createReception(input) {
    if (USE_MOCK) return restockMockService.createReception(input);
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
    if (USE_MOCK) return null;
    const metric = await this.findSuggestionsMetric();
    if (!metric) return null;
    const { data } = await apiClient.post(
      metric.path || SUGGESTIONS_PATH,
      toSuggestionsPayload(params, filters)
    );
    return (data?.data || []).map(normalizeSuggestionRow);
  },

  // Cruza las sugerencias con los productos ya cargados y devuelve las filas de
  // alerta, en el orden de urgencia que definió el backend. null si el endpoint
  // no está disponible.
  async listAlerts(products = []) {
    const rows = await this.listSuggestions();
    if (rows === null) return null;
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows
      .filter((row) => row.shouldRestock)
      .map((row) => fromSuggestionRow(row, byId.get(row.productId)));
  },

  // Posiciones candidatas para ubicar mercadería. La implementación vive en
  // warehouseConfigService (el endpoint es /warehouse/positions/available); se
  // reexpone acá porque ProductLocationModal la consume por este service.
  async getAvailablePositions({ productId, deliveryUnit, quantity }) {
    return warehouseConfigService.getAvailablePositions({
      productId,
      deliveryUnit,
      quantity,
    });
  },

  /* ---------- Ubicación diferida de un remito ---------- */

  // Si el backend ya devolvió alguna recepción con `status`, maneja remitos sin
  // ubicar. Hasta entonces la UI exige repartir todo al registrar el remito.
  supportsPendingLocation() {
    return pendingLocationCapability === true || pendingLocationSupported;
  },

  // Pregunta al catálogo si `receptions` ya declara el campo `status`. Se
  // cachea: una sola vez por sesión.
  async detectPendingLocationSupport() {
    if (pendingLocationCapability !== undefined) return pendingLocationCapability;
    // El mock implementa el flujo completo, así que lo soporta por definición.
    if (USE_MOCK) {
      pendingLocationCapability = true;
      return pendingLocationCapability;
    }
    try {
      const { data } = await apiClient.get("/query/catalog");
      const entity = (data?.entities || []).find(
        (e) => e.name === RECEPTIONS_ENTITY
      );
      // Sin la entidad no se concluye nada: puede ser un backend viejo o un rol
      // que no la ve. En los dos casos queda el fallback.
      pendingLocationCapability = entity
        ? (entity.fields || []).some((f) => f.name === PENDING_LOCATION_FIELD)
        : null;
    } catch {
      pendingLocationCapability = null;
    }
    return pendingLocationCapability;
  },

  // Remitos que todavía tienen mercadería sin posición. El backend filtra por
  // `status` desde feature/117; el viejo ignora el parámetro, pero ahí todas
  // las recepciones se normalizan como COMPLETED y el filtro local las descarta.
  async listPendingLocation() {
    // Antes de listar, se resuelve la capacidad: es lo que decide si el modal
    // de remito puede ofrecer "guardar sin ubicar", y la pantalla re-renderiza
    // recién cuando esta carga termina.
    await this.detectPendingLocationSupport();
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
    if (USE_MOCK) return restockMockService.assignReceptionPositions(id, assignments);
    const { data } = await apiClient.patch(`/restock/receptions/${id}`, {
      assignments: toAssignmentsPayload(assignments),
    });
    return normalizeReception(data?.reception ?? data);
  },

  /* ---------- Vista compuesta para la pantalla ---------- */

  // Órdenes + progreso de recepción + estado derivado + código legible.
  // Una sola llamada para el listado y otra para las recepciones, en vez de
  // N × GET /restock/orders/:id.
  async listOrdersWithProgress(filters = {}) {
    const [orders, receptions] = await Promise.all([
      this.listOrders(filters),
      this.listReceptions(),
    ]);

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

    return withDisplayCodes(
      orders.map((order) => {
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
          status: deriveStatus(order.quantityRequested, received),
        };
      })
    );
  },
};
