/*
|--------------------------------------------------------------------------
| ALERTAS DE REESTOCK
|--------------------------------------------------------------------------
|
| Dos cosas distintas, con dueños distintos:
|
| 1. QUÉ PRODUCTOS ESTÁN EN ALERTA — se deriva acá, sobre `GET /products`
|    (stock.available < stock.min). No es una regla inventada: es el mismo
|    umbral que usa el backend para disparar su evento de alerta —
|    StockDrainService: `if (totalStock < product.getMinimumStock())` → broadcast
|    por /ws/v1/stock/alerts. Ese push avisa de un producto puntual cuando se
|    drena stock, así que no sirve para pintar la tabla al entrar; el listado se
|    arma con el mismo criterio desde los productos.
|
| 2. CUÁNTO PEDIR — NO se calcula acá. Lo resuelve el backend en
|    POST /metrics/restock-suggestions (rama feature/metrics-endpoints), con
|    demanda ponderada, stock de seguridad, punto de reposición y stock en
|    tránsito. Ver restockService.listSuggestions.
|
|    Mientras ese endpoint no esté desplegado, la cantidad queda VACÍA y el
|    operador la escribe a mano en el modal. Antes había acá una fórmula
|    inventada (mínimo × 2 − actual, redondeado a decenas) que reproducía los
|    números del diseño: se eliminó para no mostrar como dato del sistema algo
|    que el sistema no calcula.
|
*/

// Condición de alerta: espejo exacto de StockDrainService (estrictamente menor).
export const needsRestock = (product) =>
  (Number(product?.minimumStock) || 0) > 0 &&
  (Number(product?.availableStock) || 0) < Number(product.minimumStock);

// Qué tan crítico es el faltante (0 = sin stock, 1 = justo en el mínimo). Ordena
// la tabla cuando la fuente es local; con el backend, las filas ya vienen
// ordenadas por urgencia y se respeta ese orden.
export const criticality = (product) => {
  const min = Number(product?.minimumStock) || 0;
  if (min <= 0) return 1;
  return Math.min(1, Math.max(0, (Number(product?.availableStock) || 0) / min));
};

/*
|--------------------------------------------------------------------------
| FORMA COMÚN DE UNA FILA DE ALERTA
|--------------------------------------------------------------------------
|
| Las dos fuentes (productos y endpoint de sugerencias) producen este mismo
| objeto, así que la tabla y el modal no saben de dónde salió. Lo único que
| cambia es `thresholdLabel` y si `suggestedQuantity` viene o queda en null.
*/

// Fuente local: un producto de `GET /products`. Sin cantidad sugerida.
export const toRestockAlert = (product) => {
  if (!product) return null;
  return {
    product,
    productId: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    imageUrl: product.imageUrl,
    availableStock: Number(product.availableStock) || 0,
    minimumStock: Number(product.minimumStock) || 0,
    threshold: Number(product.minimumStock) || 0,
    thresholdLabel: "Stock mínimo",
    // null = el backend todavía no la calculó. Distinto de 0, que sería "no
    // pidas nada".
    suggestedQuantity: null,
    criticality: criticality(product),
  };
};

// products → filas de la tabla, ordenadas de más crítica a menos.
export const buildRestockAlerts = (products = []) =>
  products.filter(needsRestock).map(toRestockAlert).sort((a, b) => a.criticality - b.criticality);

/*
| Fuente buena: una fila de POST /metrics/restock-suggestions. El backend ya
| decidió `should_restock` comparando la posición de inventario (disponible + en
| tránsito) contra el punto de reposición, así que acá no se decide nada: se
| traduce. Se conservan los campos de su modelo para poder justificar el número
| en la UI.
*/
export const fromSuggestionRow = (row, product) => {
  if (!row) return null;
  const reorderPoint = Math.round(Number(row.reorderPoint) || 0);
  const inventoryPosition = Number(row.inventoryPosition) || 0;
  return {
    product: product ?? null,
    productId: row.productId,
    name: row.name ?? product?.name ?? "",
    sku: row.sku ?? product?.sku ?? "",
    category: product?.category ?? "",
    imageUrl: product?.imageUrl ?? "",
    availableStock: Number(row.availableStock) || 0,
    minimumStock: Number(product?.minimumStock) || 0,
    threshold: reorderPoint,
    thresholdLabel: "Punto de reposición",
    suggestedQuantity: Number(row.suggestedQuantity) || 0,
    targetStock: Math.round(Number(row.targetStock) || 0),
    blendedDemand: Number(row.blendedDemand) || 0,
    recentDemand: Number(row.recentDemand) || 0,
    longTermDemand: Number(row.longTermDemand) || 0,
    safetyStock: Number(row.safetyStock) || 0,
    onOrderStock: Number(row.onOrderStock) || 0,
    inventoryPosition,
    criticality:
      reorderPoint > 0 ? Math.min(1, Math.max(0, inventoryPosition / reorderPoint)) : 0,
  };
};
