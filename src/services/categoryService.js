/*
|--------------------------------------------------------------------------
| CATEGORY SERVICE
|--------------------------------------------------------------------------
|
| Las categorías son el enum `ProductCategory` del backend
|   wh-backend/src/main/java/com/usal/whbackend/domain/ProductCategory.java
| y el `category` del producto viaja como string con el nombre del enum.
|
| El backend las expone desde el PR #105:
|   GET /products/categories → { "categories": ["TECNOLOGIA", ...] }
|
| Devuelve SOLO los nombres del enum, sin texto para mostrar, así que las
| etiquetas en castellano viven acá. Un valor nuevo que el backend agregue y que
| no esté en el diccionario se muestra capitalizado (TECNOLOGIA → Tecnologia):
| feo pero funcional, y sobre todo seleccionable — antes, un valor nuevo
| directamente no existía para el front.
|
| FALLBACK: si la llamada falla, se usa la lista local. El backend valida la
| categoría en listado/alta/edición (400 INVALID_CATEGORY), así que mandar un
| valor que no esté en el enum rompe; por eso el fallback es el espejo exacto
| del enum al día de hoy, no una lista inventada.
|
*/

import { apiClient } from "../lib/apiClient";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// Texto para mostrar. La clave es el nombre del enum tal como viaja.
export const CATEGORY_LABELS = {
  TECNOLOGIA: "Tecnología",
  HERRAMIENTAS: "Herramientas",
  ALIMENTOS: "Alimentos",
  OTROS: "Otros",
};

// Espejo del enum al día de hoy. Solo se usa si el endpoint no responde.
export const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// TECNOLOGIA → "Tecnologia". Para valores que el backend agregue y que todavía
// no tengan etiqueta acá.
const humanize = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

export const categoryService = {
  async list() {
    if (USE_MOCK) return CATEGORIES;
    try {
      const { data } = await apiClient.get("/products/categories");
      const values = data?.categories ?? [];
      if (!Array.isArray(values) || values.length === 0) return CATEGORIES;
      return values.map((value) => ({
        value,
        label: CATEGORY_LABELS[value] ?? humanize(value),
      }));
    } catch {
      return CATEGORIES;
    }
  },
};
