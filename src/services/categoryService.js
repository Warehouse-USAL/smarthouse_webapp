import { apiClient } from "../lib/apiClient";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" ||
  !import.meta.env.VITE_API_BASE_URL;

const MOCK_CATEGORIES = [
  "ALIMENTOS",
  "BEBIDAS",
  "LIMPIEZA",
  "HIGIENE_PERSONAL",
  "ELECTRONICA",
  "ELECTRODOMESTICOS",
  "INDUMENTARIA",
  "CALZADO",
  "FERRETERIA",
  "MUEBLES",
  "JUGUETES",
  "LIBRERIA",
  "FARMACIA",
  "MASCOTAS",
  "AUTOMOTOR",
  "DEPORTES",
  "OTROS",
];

export const categoryService = {
  async list() {
    if (USE_MOCK) {
      return MOCK_CATEGORIES;
    }

    const { data } = await apiClient.get(
      "/products/categories"
    );

    return data?.categories || [];
  },
};