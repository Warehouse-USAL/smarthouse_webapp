import { apiClient } from "../lib/apiClient";
import { vehicleMockService } from "./mocks/vehicleMockService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// El backend (VehicleController) devuelve el listado envuelto en
// { vehicles: [...], pagination: {...} } y cada vehículo en snake_case con
// status en minúsculas y la posición anidada en { x, y }. La UI (VehiclesPage,
// alineada con el mock) espera un array plano con status en MAYÚSCULAS y
// positionX/positionY sueltos. Este normalizer es el único dueño de esa
// traducción cable → UI.
const normalize = (raw) => {
  if (!raw) return null;
  const position = raw.position ?? {};
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status ? String(raw.status).toUpperCase() : "OFFLINE",
    battery: raw.battery ?? 0,
    positionX: position.x ?? raw.position_x ?? raw.positionX ?? 0,
    positionY: position.y ?? raw.position_y ?? raw.positionY ?? 0,
    currentOrderId: raw.current_order_id ?? raw.currentOrderId ?? null,
    lastSeenAt: raw.last_seen_at ?? raw.lastSeenAt ?? null,
  };
};

export const vehicleService = {
  async list() {
    if (USE_MOCK) return vehicleMockService.list();
    const { data } = await apiClient.get("/vehicles");
    return (data?.vehicles || []).map(normalize);
  },

  async get(id) {
    if (USE_MOCK) return vehicleMockService.get(id);
    const { data } = await apiClient.get(`/vehicles/${id}`);
    return normalize(data?.vehicle ?? data);
  },

  async register({ name }) {
    if (USE_MOCK) return vehicleMockService.register({ name });
    const { data } = await apiClient.post("/vehicles", { name });
    return normalize(data?.vehicle ?? data);
  },

  async update(id, patch) {
    if (USE_MOCK) return vehicleMockService.update(id, patch);
    const { data } = await apiClient.patch(`/vehicles/${id}`, patch);
    return normalize(data?.vehicle ?? data);
  },

  async remove(id) {
    if (USE_MOCK) return vehicleMockService.remove(id);
    await apiClient.delete(`/vehicles/${id}`);
  },
};
