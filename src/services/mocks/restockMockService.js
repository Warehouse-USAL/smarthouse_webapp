/*
|--------------------------------------------------------------------------
| RESTOCK MOCK SERVICE
|--------------------------------------------------------------------------
|
| Espejo de restockService para VITE_USE_MOCK=true. Persiste en localStorage
| (mismo patrón que el resto de los mocks) y devuelve objetos YA normalizados
| en camelCase — el mock vive del lado de la UI, no del cable.
|
| Los product_id referencian los del productMockService (PROD-00X).
|
*/

import { localStore } from "../../lib/localStore";

/*
| Las claves llevan versión.
|
| Los registros del mock pasaron de snake_case a camelCase. Con la clave vieja,
| a cualquiera que ya tuviera datos guardados le volvían registros con
| `productId`, `createdAt` y `restockOrderId` en undefined, y el progreso y los
| filtros de la pantalla quedaban rotos sin ningún error visible.
|
| Subir la versión descarta lo viejo y vuelve a sembrar. Es data de prueba: no
| vale la pena migrarla, pero sí que deje de romper en silencio.
*/
const ORDERS_KEY = "mock_restock_orders_v2";
const RECEPTIONS_KEY = "mock_restock_receptions_v2";

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const SEED_ORDERS = [
  { id: "RSO-1001", productId: "PROD-003", quantityRequested: 90,  supplier: "Samsung Argentina",   requestedByUserId: "USR-001", createdAt: daysAgo(9) },
  { id: "RSO-1002", productId: "PROD-005", quantityRequested: 150, supplier: "Textiles del Sur",    requestedByUserId: "USR-001", createdAt: daysAgo(8) },
  { id: "RSO-1003", productId: "PROD-008", quantityRequested: 100, supplier: "Deportes Mayorista",  requestedByUserId: "USR-001", createdAt: daysAgo(7) },
  { id: "RSO-1004", productId: "PROD-001", quantityRequested: 200, supplier: "Distribuidora XYZ",   requestedByUserId: "USR-001", createdAt: daysAgo(6) },
  { id: "RSO-1005", productId: "PROD-004", quantityRequested: 120, supplier: "Limpieza Total SA",   requestedByUserId: "USR-001", createdAt: daysAgo(5) },
  { id: "RSO-1006", productId: "PROD-002", quantityRequested: 300, supplier: "Aguas Cuyanas",       requestedByUserId: "USR-001", createdAt: daysAgo(4) },
  { id: "RSO-1007", productId: "PROD-006", quantityRequested: 80,  supplier: "Farma Distribución",  requestedByUserId: "USR-001", createdAt: daysAgo(3) },
  { id: "RSO-1008", productId: "PROD-007", quantityRequested: 60,  supplier: "Lubricantes del Sur", requestedByUserId: "USR-001", createdAt: daysAgo(2) },
];

// Recepciones parciales/completas sobre algunas de las órdenes sembradas, para
// que la pantalla muestre los tres estados derivados desde el arranque.
const SEED_RECEPTIONS = [
  { id: "RCP-2001", restockOrderId: "RSO-1004", productId: "PROD-001", quantityReceived: 200, deliveryUnit: "PALLET",       supplier: "Distribuidora XYZ",  assignments: [{ positionId: "POS-MOCK-1", quantity: 200 }], receivedByUserId: "USR-001", createdAt: daysAgo(5) },
  { id: "RCP-2002", restockOrderId: "RSO-1005", productId: "PROD-004", quantityReceived: 60,  deliveryUnit: "MEDIO_PALLET", supplier: "Limpieza Total SA",  assignments: [{ positionId: "POS-MOCK-2", quantity: 60 }],  receivedByUserId: "USR-001", createdAt: daysAgo(4) },
  { id: "RCP-2003", restockOrderId: "RSO-1006", productId: "PROD-002", quantityReceived: 300, deliveryUnit: "PALLET",       supplier: "Aguas Cuyanas",      assignments: [{ positionId: "POS-MOCK-3", quantity: 300 }], receivedByUserId: "USR-001", createdAt: daysAgo(3) },
  { id: "RCP-2004", restockOrderId: "RSO-1007", productId: "PROD-006", quantityReceived: 40,  deliveryUnit: "CAJA",         supplier: "Farma Distribución", assignments: [{ positionId: "POS-MOCK-4", quantity: 40 }],  receivedByUserId: "USR-001", createdAt: daysAgo(2) },
];

const readOrders = () => localStore.get(ORDERS_KEY, SEED_ORDERS);
const readReceptions = () => localStore.get(RECEPTIONS_KEY, SEED_RECEPTIONS);

const nextId = (list, prefix, start) => {
  const max = list.reduce((acc, item) => {
    const n = Number(String(item.id).replace(`${prefix}-`, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, start - 1);
  return `${prefix}-${max + 1}`;
};

const inRange = (iso, from, to) => {
  if (!iso) return true;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

export const restockMockService = {
  async listOrders({ productId, supplier, from, to } = {}) {
    return readOrders().filter(
      (o) =>
        (!productId || o.productId === productId) &&
        (!supplier || o.supplier === supplier) &&
        inRange(o.createdAt, from, to)
    );
  },

  async getOrder(id) {
    const order = readOrders().find((o) => o.id === id) || null;
    if (!order) return null;
    const received = readReceptions()
      .filter((r) => r.restockOrderId === id)
      .reduce((sum, r) => sum + r.quantityReceived, 0);
    return { ...order, quantityReceivedSoFar: received };
  },

  async createOrder({ productId, quantityRequested, supplier }) {
    const list = readOrders();
    const order = {
      id: nextId(list, "RSO", 1001),
      productId,
      quantityRequested: Number(quantityRequested) || 0,
      supplier,
      requestedByUserId: "USR-001",
      createdAt: new Date().toISOString(),
    };
    localStore.set(ORDERS_KEY, [...list, order]);
    return order;
  },

  async listReceptions({ productId, restockOrderId, from, to } = {}) {
    return readReceptions().filter(
      (r) =>
        (!productId || r.productId === productId) &&
        (!restockOrderId || r.restockOrderId === restockOrderId) &&
        inRange(r.createdAt, from, to)
    );
  },

  async getReception(id) {
    return readReceptions().find((r) => r.id === id) || null;
  },

  // Ubicación diferida de un remito (rama feature/117). Acumula assignments y
  // marca COMPLETED cuando lo ubicado iguala lo recibido, igual que el backend.
  async assignReceptionPositions(id, assignments = []) {
    const list = readReceptions();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const reception = list[index];
    const merged = [
      ...(reception.assignments || []),
      ...assignments.map((a) => ({
        positionId: a.positionId,
        quantity: Number(a.quantity) || 0,
      })),
    ];
    const located = merged.reduce((sum, a) => sum + a.quantity, 0);
    const updated = {
      ...reception,
      assignments: merged,
      status: located >= reception.quantityReceived ? "COMPLETED" : "PENDING_LOCATION",
    };
    const next = [...list];
    next[index] = updated;
    localStore.set(RECEPTIONS_KEY, next);
    return updated;
  },

  async createReception(input) {
    const list = readReceptions();
    const reception = {
      id: nextId(list, "RCP", 2001),
      restockOrderId: input.restockOrderId || null,
      productId: input.productId,
      quantityReceived: Number(input.quantityReceived) || 0,
      deliveryUnit: input.deliveryUnit,
      supplier: input.supplier,
      assignments: (input.assignments || []).map((a) => ({
        positionId: a.positionId,
        quantity: Number(a.quantity) || 0,
      })),
      receivedByUserId: "USR-001",
      createdAt: new Date().toISOString(),
    };
    localStore.set(RECEPTIONS_KEY, [...list, reception]);
    return reception;
  },
};
