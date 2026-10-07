/*
|--------------------------------------------------------------------------
| ORDER MOCK SERVICE
|--------------------------------------------------------------------------
|
| Espejo de orderService para VITE_USE_MOCK=true. Persiste en localStorage y
| devuelve objetos en camelCase (el mock vive del lado de la UI, no del cable).
|
| Los product_id referencian los del productMockService (PROD-00X) y los
| requested_by_user_id, los del userMockService (USR-00X).
|
*/

import { localStore } from "../../lib/localStore";

const ORDERS_KEY = "mock_sales_orders_v1";

const daysAgo = (n, hours = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + hours, 30, 0, 0);
  return d.toISOString();
};

const SEED_ORDERS = [
  {
    id: "ORD-1012", status: "pending", requestedByUserId: "USR-001",
    items: [{ productId: "PROD-003", sku: "SKU-ELE-001", quantity: 150 }],
    destinationArea: "AREA-B", assignedVehicleId: null,
    timestamps: { createdAt: daysAgo(0), startedAt: null, completedAt: null },
    cancelReason: null,
  },
  {
    id: "ORD-1011", status: "pending", requestedByUserId: "USR-003",
    items: [{ productId: "PROD-008", sku: "SKU-DEP-001", quantity: 200 }],
    destinationArea: "AREA-A", assignedVehicleId: null,
    timestamps: { createdAt: daysAgo(0, 3), startedAt: null, completedAt: null },
    cancelReason: null,
  },
  {
    id: "ORD-1010", status: "in_progress", requestedByUserId: "USR-001",
    items: [
      { productId: "PROD-001", sku: "SKU-ALI-001", quantity: 300 },
      { productId: "PROD-002", sku: "SKU-BEB-001", quantity: 150 },
    ],
    destinationArea: "AREA-C", assignedVehicleId: "VHC-001",
    timestamps: { createdAt: daysAgo(1), startedAt: daysAgo(1, 2), completedAt: null },
    cancelReason: null,
  },
  {
    id: "ORD-1009", status: "pending", requestedByUserId: "USR-005",
    items: [{ productId: "PROD-006", sku: "SKU-FAR-001", quantity: 500 }],
    destinationArea: "AREA-B", assignedVehicleId: null,
    timestamps: { createdAt: daysAgo(1, 5), startedAt: null, completedAt: null },
    cancelReason: null,
  },
  {
    id: "ORD-1008", status: "completed", requestedByUserId: "USR-003",
    items: [{ productId: "PROD-004", sku: "SKU-LIM-001", quantity: 300 }],
    destinationArea: "AREA-A", assignedVehicleId: "VHC-002",
    timestamps: { createdAt: daysAgo(2), startedAt: daysAgo(2, 2), completedAt: daysAgo(2, 5) },
    cancelReason: null,
  },
  {
    id: "ORD-1007", status: "completed", requestedByUserId: "USR-001",
    items: [{ productId: "PROD-007", sku: "SKU-AUT-001", quantity: 1000 }],
    destinationArea: "AREA-C", assignedVehicleId: "VHC-001",
    timestamps: { createdAt: daysAgo(3), startedAt: daysAgo(3, 1), completedAt: daysAgo(3, 4) },
    cancelReason: null,
  },
  {
    id: "ORD-1006", status: "cancelled", requestedByUserId: "USR-005",
    items: [{ productId: "PROD-005", sku: "SKU-IND-001", quantity: 400 }],
    destinationArea: "AREA-B", assignedVehicleId: null,
    timestamps: { createdAt: daysAgo(3, 2), startedAt: null, completedAt: null },
    cancelReason: "INSUFFICIENT_STOCK: sin stock disponible al asignar rover.",
  },
  {
    id: "ORD-1005", status: "completed", requestedByUserId: "USR-003",
    items: [{ productId: "PROD-002", sku: "SKU-BEB-001", quantity: 750 }],
    destinationArea: "AREA-A", assignedVehicleId: "VHC-003",
    timestamps: { createdAt: daysAgo(5), startedAt: daysAgo(5, 1), completedAt: daysAgo(5, 3) },
    cancelReason: null,
  },
  {
    id: "ORD-1004", status: "completed", requestedByUserId: "USR-001",
    items: [{ productId: "PROD-001", sku: "SKU-ALI-001", quantity: 150 }],
    destinationArea: "AREA-B", assignedVehicleId: "VHC-002",
    timestamps: { createdAt: daysAgo(9), startedAt: daysAgo(9, 2), completedAt: daysAgo(9, 3) },
    cancelReason: null,
  },
  {
    id: "ORD-1003", status: "cancelled", requestedByUserId: "USR-005",
    items: [{ productId: "PROD-008", sku: "SKU-DEP-001", quantity: 250 }],
    destinationArea: "AREA-C", assignedVehicleId: null,
    timestamps: { createdAt: daysAgo(12), startedAt: null, completedAt: null },
    cancelReason: "Cancelada por el usuario: pedido duplicado.",
  },
  {
    id: "ORD-1002", status: "completed", requestedByUserId: "USR-003",
    items: [{ productId: "PROD-005", sku: "SKU-IND-001", quantity: 600 }],
    destinationArea: "AREA-A", assignedVehicleId: "VHC-001",
    timestamps: { createdAt: daysAgo(25), startedAt: daysAgo(25, 1), completedAt: daysAgo(25, 4) },
    cancelReason: null,
  },
  {
    id: "ORD-1001", status: "completed", requestedByUserId: "USR-001",
    items: [{ productId: "PROD-004", sku: "SKU-LIM-001", quantity: 450 }],
    destinationArea: "AREA-B", assignedVehicleId: "VHC-002",
    timestamps: { createdAt: daysAgo(45), startedAt: daysAgo(45, 2), completedAt: daysAgo(45, 5) },
    cancelReason: null,
  },
];

const readOrders = () => localStore.get(ORDERS_KEY, SEED_ORDERS);

const isoDay = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export const orderMockService = {
  async list({ status, from, to, vehicleId } = {}) {
    return readOrders().filter(
      (o) =>
        (!status || o.status === status) &&
        (!vehicleId || o.assignedVehicleId === vehicleId) &&
        (!from || isoDay(o.timestamps?.createdAt) >= from) &&
        (!to || isoDay(o.timestamps?.createdAt) <= to)
    );
  },

  async get(id) {
    return readOrders().find((o) => o.id === id) || null;
  },

  async cancel(id, reason) {
    const list = readOrders();
    const index = list.findIndex((o) => o.id === id);
    if (index === -1) return null;
    const updated = { ...list[index], status: "cancelled", cancelReason: reason };
    const next = [...list];
    next[index] = updated;
    localStore.set(ORDERS_KEY, next);
    return updated;
  },
};
