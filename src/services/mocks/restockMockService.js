import { localStore } from "../../lib/localStore";
import { UNIT_TO_SIZE } from "../../lib/storageCompatibility";
import { warehouseConfigMockService } from "./warehouseConfigMockService";

const ORDERS_KEY = "mock_restock_orders";
const RECEPTIONS_KEY = "mock_restock_receptions";

// Mismas órdenes de maqueta que usaba StockManagementPage, ahora con el shape
// del contrato (snake_case) + supplier. El orden list→detalle replicará el
// backend: el listado NO trae quantity_received_so_far (solo el detalle).
const ORDERS_SEED = [
  { id: "RSO-10023", product_id: "PROD-001", quantity_requested: 10, supplier: "Distribuidora XYZ", created_at: "2026-05-22T09:40:00Z" },
  { id: "RSO-10022", product_id: "PROD-002", quantity_requested: 40, supplier: "Alimentos del Sur", created_at: "2026-05-21T15:05:00Z" },
  { id: "RSO-10021", product_id: "PROD-003", quantity_requested: 60, supplier: "TecnoImport SRL", created_at: "2026-05-21T11:30:00Z" },
  { id: "RSO-10020", product_id: "PROD-004", quantity_requested: 35, supplier: "Limpieza Total SA", created_at: "2026-05-20T17:20:00Z" },
  { id: "RSO-10019", product_id: "PROD-005", quantity_requested: 25, supplier: "Textil Hogar", created_at: "2026-05-20T08:55:00Z" },
  { id: "RSO-10018", product_id: "PROD-006", quantity_requested: 50, supplier: "Farmacia Mayorista", created_at: "2026-05-19T10:30:00Z" },
  { id: "RSO-10017", product_id: "PROD-007", quantity_requested: 30, supplier: "AutoRepuestos RG", created_at: "2026-05-19T09:15:00Z" },
  { id: "RSO-10016", product_id: "PROD-008", quantity_requested: 20, supplier: "Deportes Integrales", created_at: "2026-05-18T16:45:00Z" },
  { id: "RSO-10015", product_id: "PROD-001", quantity_requested: 25, supplier: "Distribuidora XYZ", created_at: "2026-05-18T11:20:00Z" },
  { id: "RSO-10014", product_id: "PROD-003", quantity_requested: 15, supplier: "TecnoImport SRL", created_at: "2026-05-17T14:10:00Z" },
  { id: "RSO-10013", product_id: "PROD-006", quantity_requested: 12, supplier: "Farmacia Mayorista", created_at: "2026-05-17T10:05:00Z" },
  { id: "RSO-10012", product_id: "PROD-008", quantity_requested: 18, supplier: "Deportes Integrales", created_at: "2026-05-16T16:40:00Z" },
  { id: "RSO-10011", product_id: "PROD-002", quantity_requested: 45, supplier: "Alimentos del Sur", created_at: "2026-05-16T12:15:00Z" },
];

// Recepciones de ejemplo, enlazadas a las órdenes de arriba. `assignments`
// opcional; sin él, la orden queda "recibida" pero sin ubicar (nuestro flujo).
const RECEPTIONS_SEED = [
  { id: "RCP-2001", restock_order_id: "RSO-10015", product_id: "PROD-001", quantity_received: 25, delivery_unit: "CAJA", supplier: "Distribuidora XYZ", assignments: [{ position_id: "POS-A-01-01", quantity: 25 }], created_at: "2026-05-18T14:00:00Z" },
  { id: "RCP-2002", restock_order_id: "RSO-10016", product_id: "PROD-008", quantity_received: 8, delivery_unit: "MEDIO_PALLET", supplier: "Deportes Integrales", assignments: [], created_at: "2026-05-19T10:00:00Z" },
  { id: "RCP-2003", restock_order_id: "RSO-10017", product_id: "PROD-007", quantity_received: 14, delivery_unit: "PALLET", supplier: "AutoRepuestos RG", assignments: [], created_at: "2026-05-19T12:00:00Z" },
];

const readOrders = () => localStore.get(ORDERS_KEY, ORDERS_SEED);
const writeOrders = (list) => localStore.set(ORDERS_KEY, list);
const readReceptions = () => localStore.get(RECEPTIONS_KEY, RECEPTIONS_SEED);
const writeReceptions = (list) => localStore.set(RECEPTIONS_KEY, list);

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const nextOrderId = (list) => {
  const max = list
    .map((o) => parseInt(String(o.id || "").replace(/\D/g, ""), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `RSO-${String(max + 1).padStart(4, "0")}`;
};

const paginate = (list, page, size) => {
  const start = page * size;
  const items = list.slice(start, start + size);
  return {
    orders: items,
    pagination: {
      page,
      size,
      total_elements: list.length,
      total_pages: Math.max(1, Math.ceil(list.length / size)),
    },
  };
};

// El backend solo expone quantity_received_so_far en el DETALLE. Este mock
// replica eso: acumula las recepciones que referencian la orden.
const receivedSoFar = (orderId) =>
  readReceptions()
    .filter((r) => r.restock_order_id === orderId)
    .reduce((sum, r) => sum + (r.quantity_received || 0), 0);

export const restockMockService = {
  async listOrders({ productId, supplier, from, to, page = 0, size = 20 } = {}) {
    await delay();
    let results = readOrders();

    if (productId) results = results.filter((o) => o.product_id === productId);
    if (supplier) {
      const q = supplier.toLowerCase();
      results = results.filter((o) => (o.supplier || "").toLowerCase().includes(q));
    }
    if (from) results = results.filter((o) => o.created_at.slice(0, 10) >= from);
    if (to) results = results.filter((o) => o.created_at.slice(0, 10) <= to);

    return paginate(results, page, size);
  },

  async getOrder(id) {
    await delay();
    const order = readOrders().find((o) => o.id === id);
    if (!order) {
      throw {
        response: {
          data: {
            error: { code: "RESTOCK_ORDER_NOT_FOUND", message: "Orden no encontrada." },
          },
        },
      };
    }
    return { ...order, quantity_received_so_far: receivedSoFar(id) };
  },

  async createOrder({ productId, quantityRequested, supplier }) {
    await delay();
    const list = readOrders();
    const created = {
      id: nextOrderId(list),
      product_id: productId,
      quantity_requested: Number(quantityRequested) || 0,
      supplier,
      requested_by_user_id: null,
      created_at: new Date().toISOString(),
    };
    writeOrders([created, ...list]);
    return created;
  },

  async listReceptions({ productId, restockOrderId, from, to, page = 0, size = 20 } = {}) {
    await delay();
    let results = readReceptions();
    if (productId) results = results.filter((r) => r.product_id === productId);
    if (restockOrderId) results = results.filter((r) => r.restock_order_id === restockOrderId);
    if (from) results = results.filter((r) => r.created_at.slice(0, 10) >= from);
    if (to) results = results.filter((r) => r.created_at.slice(0, 10) <= to);

    const start = page * size;
    return {
      receptions: results.slice(start, start + size),
      pagination: {
        page,
        size,
        total_elements: results.length,
        total_pages: Math.max(1, Math.ceil(results.length / size)),
      },
    };
  },

  async getReception(id) {
    await delay();
    const reception = readReceptions().find((r) => r.id === id);
    if (!reception) {
      throw {
        response: { data: { error: { code: "RECEPTION_NOT_FOUND", message: "Recepción no encontrada." } } },
      };
    }
    return reception;
  },

  async createReception(input) {
    await delay();
    const list = readReceptions();
    const created = {
      id: `RCP-${String(list.length + 2001).padStart(4, "0")}`,
      restock_order_id: input.restockOrderId ?? null,
      product_id: input.productId,
      quantity_received: Number(input.quantityReceived) || 0,
      delivery_unit: input.deliveryUnit,
      supplier: input.supplier,
      assignments: (input.assignments || []).map((a) => ({
        position_id: a.positionId,
        quantity: a.quantity,
      })),
      received_by_user_id: null,
      created_at: new Date().toISOString(),
    };
    writeReceptions([created, ...list]);
    return created;
  },

  // Posiciones disponibles reutilizando el árbol mock del warehouse: sin otro
  // producto asignado y del tamaño pedido (CAJA/MEDIO_PALLET/PALLET). El mock
  // del warehouse usa PEQUEÑA/MEDIANA/GRANDE, así que traducimos con
  // UNIT_TO_SIZE (misma correspondencia que el service real).
  async getAvailablePositions({ productId, deliveryUnit, quantity }) {
    await delay();
    const config = await warehouseConfigMockService.get();
    const zones = config?.zones || [];
    const available = [];

    for (const zone of zones) {
      for (const line of zone.lines || []) {
        for (const position of line.positions || []) {
          const sameUnit =
            UNIT_TO_SIZE[position.sizeStockToSave] === String(deliveryUnit || "").toUpperCase();
          const positionProductId =
            position.assignedProduct?.id ?? position.productId ?? null;
          const free =
            !positionProductId ||
            String(positionProductId) === String(productId);
          if (position.isActive === false || !sameUnit || !free) continue;

          const availableUnits =
            Math.max(0, (position.maximumCapacity || 1000) - (position.currentStock || 0));
          if (availableUnits <= 0 || availableUnits < Number(quantity)) continue;

          available.push({
            position_id: position.idPosition,
            position_name: position.positionName,
            available_units: availableUnits,
          });
        }
      }
    }

    available.sort((a, b) => b.available_units - a.available_units);
    return { positions: available };
  },
};