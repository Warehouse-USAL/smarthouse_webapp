/*
|--------------------------------------------------------------------------
| CATEGORY SERVICE
|--------------------------------------------------------------------------
|
| Contrato Backend:
|
|   GET /products/categories
|
| Response:
| {
|   "categories": [
|     "CHUPETINES",
|     "GOLOSINAS",
|     "SNACKS",
|     "BEBIDAS"
|   ]
| }
|
| Las categorías son definidas por Backend.
| El Front NO crea categorías nuevas.
|
*/

import { apiClient } from "../lib/apiClient";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" ||
  !import.meta.env.VITE_API_BASE_URL;

const MOCK_CATEGORIES = [
  "CHUPETINES",
  "GOLOSINAS",
  "SNACKS",
  "BEBIDAS",
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