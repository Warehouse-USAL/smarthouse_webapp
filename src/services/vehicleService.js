import { apiClient } from "../lib/apiClient";

export const vehicleService = {
  async list() {
    const { data } = await apiClient.get("/vehicles");
    return data || [];
  },

  async get(id) {
    const { data } = await apiClient.get(`/vehicles/${id}`);
    return data;
  },

  async register({ name }) {
    const { data } = await apiClient.post("/vehicles", { name });
    return data;
  },
};
