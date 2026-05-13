import { apiClient } from "../lib/apiClient";
import { vehicleMockService } from "./mocks/vehicleMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_AUTH === "true" || !import.meta.env.VITE_API_BASE_URL;

export const vehicleService = {
  async list() {
    if (USE_MOCK) return vehicleMockService.list();
    const { data } = await apiClient.get("/vehicles");
    return data || [];
  },

  async get(id) {
    if (USE_MOCK) return vehicleMockService.get(id);
    const { data } = await apiClient.get(`/vehicles/${id}`);
    return data;
  },

  async register({ name }) {
    if (USE_MOCK) return vehicleMockService.register({ name });
    const { data } = await apiClient.post("/vehicles", { name });
    return data;
  },

  async update(id, patch) {
    if (USE_MOCK) return vehicleMockService.update(id, patch);
    const { data } = await apiClient.patch(`/vehicles/${id}`, patch);
    return data;
  },

  async remove(id) {
    if (USE_MOCK) return vehicleMockService.remove(id);
    await apiClient.delete(`/vehicles/${id}`);
  },
};
