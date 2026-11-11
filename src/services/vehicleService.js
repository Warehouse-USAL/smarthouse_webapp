import { apiClient } from "../lib/apiClient";


// El backend (VehicleController) devuelve el listado envuelto en
// { vehicles: [...], pagination: {...} } y cada vehículo en snake_case con
// status en minúsculas y la posición anidada en { x, y }. La UI (VehiclesPage)
// espera un array plano con status en MAYÚSCULAS y
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
  /*
  | Una página de vehículos por nombre (A→Z). GET /vehicles pagina pero no filtra
  | por nombre ni estado; POST /query/vehicles sí, y devuelve solo los ids que
  | se piden: el detalle de cada fila sale de GET /vehicles/:id.
  | page es 1-based; status en MAYÚSCULAS, como se guarda (IDLE, BUSY…).
  */
  async listPage({ page = 1, size = 10, search, status } = {}) {
    const filters = [];
    if (search) filters.push({ field: "name", op: "contains", value: search });
    if (status) filters.push({ field: "status", op: "eq", value: status });
    const { data } = await apiClient.post("/query/vehicles", {
      filters,
      sort: [{ field: "name", dir: "asc" }],
      page: page - 1,
      size,
      fields: ["id"],
    });
    const items = await Promise.all((data?.items || []).map(({ id }) => this.get(id)));
    const pagination = data?.pagination ?? {};
    return {
      items,
      totalPages: pagination.total_pages ?? 0,
      totalElements: pagination.total_elements ?? 0,
    };
  },

  async get(id) {
    const { data } = await apiClient.get(`/vehicles/${id}`);
    return normalize(data?.vehicle ?? data);
  },

  async register({ name }) {
    const { data } = await apiClient.post("/vehicles", { name });
    return normalize(data?.vehicle ?? data);
  },

  async update(id, patch) {
    const { data } = await apiClient.patch(`/vehicles/${id}`, patch);
    return normalize(data?.vehicle ?? data);
  },

  async remove(id) {
    await apiClient.delete(`/vehicles/${id}`);
  },
};
