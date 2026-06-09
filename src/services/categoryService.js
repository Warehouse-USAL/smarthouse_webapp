/*
|--------------------------------------------------------------------------
| CATEGORY SERVICE
|--------------------------------------------------------------------------
|
| El backend (wh-backend) NO expone un endpoint de categorías: las categorías
| son un enum fijo `ProductCategory`
|   wh-backend/src/main/java/com/usal/whbackend/domain/ProductCategory.java
| y el `category` del producto viaja como string con el nombre del enum.
|
| Desde el alta del enum (PR #64) el backend VALIDA la categoría (case-insensitive)
| en el filtro de listado, en el alta y en la edición; si no coincide responde
| 400 INVALID_CATEGORY ("La categoría indicada no existe."). Por eso esta lista
| debe ser un espejo exacto del enum: mandar un valor que no esté acá rompe.
|
| `value` es lo que viaja por el cable (nombre del enum, en mayúsculas).
| `label` es solo para mostrar en la UI.
|
| Al agregar/quitar un valor en el enum del backend, actualizar esta lista.
|
*/

export const CATEGORIES = [
  { value: "TECNOLOGIA", label: "Tecnología" },
  { value: "HERRAMIENTAS", label: "Herramientas" },
  { value: "ALIMENTOS", label: "Alimentos" },
  { value: "OTROS", label: "Otros" },
];

export const categoryService = {
  async list() {
    return CATEGORIES;
  },
};
