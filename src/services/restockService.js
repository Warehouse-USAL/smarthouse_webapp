/*
|--------------------------------------------------------------------------
| RESTOCK SERVICE
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, RFC "Reposición de stock" — GitHub
| Warehouse-USAL/wh-general#5):
|   POST  /restock/orders                       CreateRestockOrderRequest
|   GET   /restock/orders           params: productId, supplier, from, to, page, size
|   GET   /restock/orders/:id       detalle enriquecido (incluye quantity_received_so_far)
|   POST  /restock/receptions       CreateReceptionRequest (asignaciones atómicas)
|   GET   /restock/receptions       params: productId, restockOrderId, from, to, page, size
|   GET   /restock/receptions/:id   detalle (desglose por posición)
|   GET   /warehouse/positions/available
|                                  params: productId, deliveryUnit (StockSize), quantity
|
| El backend serializa los BODY en snake_case (JacksonConfig SNAKE_CASE); los
| @RequestParam se declaran en camelCase (productId, deliveryUnit, supplier…)
| según la RFC. Este service es el único dueño de la traducción camelCase (UI)
| ↔ wire (pero no toca la asignación de posiciones: eso vive en
| warehouseConfigService.assignProductToPosition / PATCH /warehouse/positions/:id).
|
| Nota del flujo webapp: POST /restock/receptions exige assignments[] (RN-07);
| el equipo de webapp registra la recepción SIN ubicación y delega la ubicación
| a la pestaña de asignación. Por eso este service NO se usa hoy para crear
| recepciones desde la UI (RemitoModal queda como está), solo para listar.
|
*/

import { apiClient } from "../lib/apiClient";
import { restockMockService } from "./mocks/restockMockService";

// Backend same-origin vía proxy de Vite: el único interruptor es el flag.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/*
|--------------------------------------------------------------------------
| NORMALIZERS  (snake_case/camelCase backend → camelCase UI)
|--------------------------------------------------------------------------
*/

const normalizeAssignment = (raw = {}) => ({
  positionId: raw.position_id ?? raw.positionId,
  positionName: raw.position_name ?? raw.positionName ?? null,
  quantity: raw.quantity ?? 0,
});

const normalizeRestockOrder = (raw = {}) => ({
  id: raw.id,
  productId: raw.product_id ?? raw.productId,
  quantityRequested: raw.quantity_requested ?? raw.quantityRequested ?? 0,
  quantityReceivedSoFar:
    raw.quantity_received_so_far ?? raw.quantityReceivedSoFar ?? 0,
  supplier: raw.supplier ?? "",
  requestedByUserId:
    raw.requested_by_user_id ?? raw.requestedByUserId ?? null,
  createdAt: raw.created_at ?? raw.createdAt ?? null,
});

const normalizeReception = (raw = {}) => ({
  id: raw.id,
  restockOrderId: raw.restock_order_id ?? raw.restockOrderId ?? null,
  productId: raw.product_id ?? raw.productId,
  quantityReceived: raw.quantity_received ?? raw.quantityReceived ?? 0,
  deliveryUnit: raw.delivery_unit ?? raw.deliveryUnit ?? null,
  supplier: raw.supplier ?? "",
  assignments: (raw.assignments || []).map(normalizeAssignment),
  receivedByUserId:
    raw.received_by_user_id ?? raw.receivedByUserId ?? null,
  createdAt: raw.created_at ?? raw.createdAt ?? null,
});

const normalizeAvailablePosition = (raw = {}) => ({
  positionId: raw.position_id ?? raw.positionId,
  positionName: raw.position_name ?? raw.positionName,
  availableUnits: raw.available_units ?? raw.availableUnits ?? 0,
});

const normalizePagination = (raw, fallbackSize) => {
  if (!raw)
    return { page: 0, size: fallbackSize, totalElements: 0, totalPages: 1 };
  return {
    page: raw.page ?? 0,
    size: raw.size ?? fallbackSize,
    totalElements: raw.total_elements ?? raw.totalElements ?? 0,
    totalPages: raw.total_pages ?? raw.totalPages ?? 1,
  };
};

/*
|--------------------------------------------------------------------------
| PAYLOAD BUILDERS  (camelCase UI → snake_case wire)
|--------------------------------------------------------------------------
*/

const toCreateOrderPayload = (input) => ({
  product_id: input.productId,
  quantity_requested: Number(input.quantityRequested) || 0,
  supplier: input.supplier,
});

const toCreateReceptionPayload = (input) => ({
  restock_order_id: input.restockOrderId ?? null,
  product_id: input.productId,
  quantity_received: Number(input.quantityReceived) || 0,
  delivery_unit: input.deliveryUnit,
  supplier: input.supplier,
  assignments: (input.assignments ?? []).map((a) => ({
    position_id: a.positionId,
    quantity: a.quantity,
  })),
});

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

export const restockService = {
  async listOrders({
    productId,
    supplier,
    from,
    to,
    page = 0,
    size = 20,
  } = {}) {
    const params = { page, size };
    if (productId) params.productId = productId;
    if (supplier) params.supplier = supplier;
    if (from) params.from = from;
    if (to) params.to = to;

    if (USE_MOCK) {
      const data = await restockMockService.listOrders({
        productId,
        supplier,
        from,
        to,
        page,
        size,
      });
      return {
        orders: (data?.orders || []).map(normalizeRestockOrder),
        pagination: normalizePagination(data?.pagination, size),
      };
    }

    const { data } = await apiClient.get("/restock/orders", { params });
    return {
      orders: (
        data?.restock_orders ??
        data?.orders ??
        data?.items ??
        []
      ).map(normalizeRestockOrder),
      pagination: normalizePagination(data?.pagination, size),
    };
  },

  async getOrder(id) {
    if (USE_MOCK) return normalizeRestockOrder(await restockMockService.getOrder(id));
    const { data } = await apiClient.get(`/restock/orders/${id}`);
    return normalizeRestockOrder(data?.restock_order ?? data);
  },

  async createOrder({ productId, quantityRequested, supplier }) {
    if (USE_MOCK) {
      return normalizeRestockOrder(
        await restockMockService.createOrder({ productId, quantityRequested, supplier })
      );
    }
    const { data } = await apiClient.post(
      "/restock/orders",
      toCreateOrderPayload({ productId, quantityRequested, supplier })
    );
    return normalizeRestockOrder(data?.restock_order ?? data);
  },

  // Recepciones: hoy la UI no crea recepciones (flujo webapp = recepción sin
  // ubicación). Exponemos listado/detalle/alta por completitud del contrato.
  async listReceptions({
    productId,
    restockOrderId,
    from,
    to,
    page = 0,
    size = 20,
  } = {}) {
    const params = { page, size };
    if (productId) params.productId = productId;
    if (restockOrderId) params.restockOrderId = restockOrderId;
    if (from) params.from = from;
    if (to) params.to = to;

    if (USE_MOCK) {
      const data = await restockMockService.listReceptions({
        productId,
        restockOrderId,
        from,
        to,
        page,
        size,
      });
      return {
        receptions: (data?.receptions || []).map(normalizeReception),
        pagination: normalizePagination(data?.pagination, size),
      };
    }

    const { data } = await apiClient.get("/restock/receptions", { params });
    return {
      receptions: (
        data?.receptions ??
        data?.items ??
        []
      ).map(normalizeReception),
      pagination: normalizePagination(data?.pagination, size),
    };
  },

  async getReception(id) {
    if (USE_MOCK) return normalizeReception(await restockMockService.getReception(id));
    const { data } = await apiClient.get(`/restock/receptions/${id}`);
    return normalizeReception(data?.reception ?? data);
  },

  async createReception(input) {
    if (USE_MOCK) {
      return normalizeReception(await restockMockService.createReception(input));
    }
    const { data } = await apiClient.post(
      "/restock/receptions",
      toCreateReceptionPayload(input)
    );
    return normalizeReception(data?.reception ?? data);
  },

  // Posiciones donde se puede ubicar una recepción/stock de un producto:
  // activas, del tamaño de la unidad de entrega, mismas producto (o vacías) y
  // con available_units > 0, ordenadas de mayor a menor capacidad.
  async getAvailablePositions({ productId, deliveryUnit, quantity }) {
    const params = {
      productId,
      deliveryUnit,
      quantity,
    };

    if (USE_MOCK) {
      const data = await restockMockService.getAvailablePositions(params);
      return (data?.positions || []).map(normalizeAvailablePosition);
    }

    const { data } = await apiClient.get("/warehouse/positions/available", {
      params,
    });
    return (data?.positions || []).map(normalizeAvailablePosition);
  },
};