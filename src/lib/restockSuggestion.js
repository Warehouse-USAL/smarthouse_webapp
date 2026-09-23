/*
|--------------------------------------------------------------------------
| ALERTAS DE REESTOCK
|--------------------------------------------------------------------------
|
| Dos preguntas distintas: QUÉ reponer y CUÁNTO pedir.
|
| El backend tiene una respuesta buena para las dos en
| POST /metrics/restock-suggestions (demanda ponderada, stock de seguridad,
| punto de reposición). Ese endpoint vive en la rama feature/metrics-endpoints
| y el equipo de backend confirmó que NO la va a mergear, así que no va a
| existir en producción.
|
| Igual se sigue consultando primero: si algún día aparece, gana (ver
| restockService.listAlerts / findSuggestionsMetric). Lo de acá abajo es el
| plan B que corre siempre en la práctica.
|
|--------------------------------------------------------------------------
| POR QUÉ ESTE CÁLCULO Y NO EL DEL BACKEND
|--------------------------------------------------------------------------
|
| El del backend es una proyección de demanda: mira cuánto se consumió en los
| últimos N días y estima cuánto se va a consumir. Acá no se puede reproducir,
| y no por falta de ganas:
|
|   - La demanda sale de las órdenes de salida. La Query API las expone
|     (POST /query/orders), pero `items.quantity` e `items.product_id` vienen
|     marcados `selectable: false` en GET /query/catalog: se puede filtrar por
|     ellos, no leerlos. Sin las cantidades por producto no hay serie de
|     consumo.
|   - Aunque fueran seleccionables, habría que paginar el histórico entero de
|     órdenes en el browser en cada carga de la pantalla.
|
| Entonces esto NO es una proyección de demanda y no se presenta como tal. Es
| una política de reposición por nivel: se repone hasta un múltiplo del stock
| mínimo, descontando lo que ya viene en camino. Es la misma familia de regla
| que un (s, S) de manual: pedís cuando caés abajo de `s`, y pedís hasta `S`.
|
| Todo lo que entra al cálculo es dato real del backend:
|
|   availableStock       GET /products -> stock.available
|   minimumStock         GET /products -> stock.min
|   maxQuantityPerOrder  GET /products -> order_constraints.max_quantity_per_order
|   onOrderStock         GET /restock/orders, lo pendiente de recibir
|
| Lo único que ponemos nosotros es `coverageMultiplier`, que es una decisión
| de negocio explícita y está abajo con nombre propio, no escondida en una
| cuenta.
|
| Cada fila lleva `suggestionSource` ("backend" | "local") para que la UI pueda
| decir de dónde salió el número en vez de hacerlo pasar por cálculo del
| sistema.
|
*/

/*
|--------------------------------------------------------------------------
| POLÍTICA DE REPOSICIÓN (la parte que es decisión nuestra)
|--------------------------------------------------------------------------
*/
export const LOCAL_RESTOCK_POLICY = {
  // Hasta cuánto reponer, en múltiplos del stock mínimo. 2 = después de que
  // entre el pedido, el producto queda con el doble de su mínimo; o sea, un
  // mínimo entero de colchón por encima del umbral que dispara la alerta.
  // Subirlo pide más por vez y dispara menos seguido; bajarlo, al revés.
  coverageMultiplier: 2,
};

/*
|--------------------------------------------------------------------------
| STOCK EN TRÁNSITO
|--------------------------------------------------------------------------
|
| Lo ya pedido a proveedores y todavía no recibido. Importa porque sin esto la
| pantalla insiste en reponer algo que está por llegar: un producto con 4
| unidades, mínimo 15 y 26 ya pedidas no necesita otra orden.
|
| Se arma con las órdenes de restock que la pantalla ya tiene cargadas
| (listOrdersWithProgress), así que no agrega ningún request.
*/
export const buildOnOrderStock = (orders = []) => {
  const byProduct = new Map();
  for (const order of orders) {
    const pending =
      (Number(order?.quantityRequested) || 0) - (Number(order?.quantityReceived) || 0);
    if (pending <= 0) continue;
    const key = order?.productId;
    if (!key) continue;
    byProduct.set(key, (byProduct.get(key) || 0) + pending);
  }
  return byProduct;
};

/*
|--------------------------------------------------------------------------
| CONDICIÓN DE ALERTA
|--------------------------------------------------------------------------
|
| Espejo exacto de StockDrainService: `totalStock < minimumStock`, estrictamente
| menor. Es el mismo umbral con el que el backend dispara el push de
| /ws/v1/stock/alerts, así que la tabla y el aviso en vivo coinciden.
|
| Acá NO entra el stock en tránsito, a propósito. Tener 26 unidades pedidas no
| hace que un producto con 4 en góndola y mínimo 15 deje de estar en falta: el
| depósito sigue sin material hasta que el remito entre. Si se filtrara por
| posición de inventario, ese producto desaparecería de la pantalla y el
| operador perdería de vista un faltante real.
|
| Lo en tránsito sí cambia CUÁNTO pedir — ver suggestQuantity.
*/
export const needsRestock = (product) =>
  (Number(product?.minimumStock) || 0) > 0 &&
  (Number(product?.availableStock) || 0) < Number(product.minimumStock);

// Qué tan crítico es el faltante (0 = sin stock, 1 = justo en el mínimo).
// Ordena la tabla cuando la fuente es local; con el backend, las filas ya
// vienen ordenadas por urgencia y se respeta ese orden. Mira el disponible,
// no la posición: lo urgente es lo que falta hoy en el depósito.
export const criticality = (product) => {
  const min = Number(product?.minimumStock) || 0;
  if (min <= 0) return 1;
  return Math.min(1, Math.max(0, (Number(product?.availableStock) || 0) / min));
};

/*
| Cuánto pedir: lo que falta para llegar al objetivo, descontando lo que ya
| viene en camino, y sin pasarse del máximo por orden que define el producto.
|
| Devuelve 0 (no null) cuando no hay nada que pedir: acá el número siempre se
| sabe. `null` queda reservado para "no se calculó", que con esta fuente no
| pasa nunca.
*/
export const suggestQuantity = (product, onOrderStock = 0, policy = LOCAL_RESTOCK_POLICY) => {
  const min = Number(product?.minimumStock) || 0;
  if (min <= 0) return 0;

  const position = (Number(product?.availableStock) || 0) + (Number(onOrderStock) || 0);
  const target = min * (Number(policy?.coverageMultiplier) || 1);
  const faltante = Math.ceil(target - position);
  if (faltante <= 0) return 0;

  // El producto puede tener un tope por orden; si lo tiene, manda.
  const tope = Number(product?.maxQuantityPerOrder) || 0;
  return tope > 0 ? Math.min(faltante, tope) : faltante;
};

/*
|--------------------------------------------------------------------------
| FORMA COMÚN DE UNA FILA DE ALERTA
|--------------------------------------------------------------------------
|
| Las dos fuentes (local y endpoint de sugerencias) producen este mismo objeto,
| así que la tabla y el modal no saben de dónde salió. `suggestionSource`
| existe para que la UI pueda aclararlo en un tooltip, no para ramificar
| lógica.
*/

// Fuente local: un producto de `GET /products` + su stock en tránsito.
export const toRestockAlert = (product, onOrderStock = 0, policy = LOCAL_RESTOCK_POLICY) => {
  if (!product) return null;
  const available = Number(product.availableStock) || 0;
  const min = Number(product.minimumStock) || 0;
  const onOrder = Number(onOrderStock) || 0;
  return {
    product,
    productId: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    imageUrl: product.imageUrl,
    availableStock: available,
    minimumStock: min,
    threshold: min,
    thresholdLabel: "Stock mínimo",
    suggestedQuantity: suggestQuantity(product, onOrder, policy),
    targetStock: min * (Number(policy?.coverageMultiplier) || 1),
    onOrderStock: onOrder,
    inventoryPosition: available + onOrder,
    maxQuantityPerOrder: Number(product.maxQuantityPerOrder) || 0,
    suggestionSource: "local",
    criticality: criticality(product),
  };
};

// products (+ órdenes abiertas) → filas de la tabla, de más crítica a menos.
// Quién entra lo decide el stock disponible; lo pedido sólo ajusta la cantidad.
export const buildRestockAlerts = (
  products = [],
  orders = [],
  policy = LOCAL_RESTOCK_POLICY
) => {
  const onOrder = buildOnOrderStock(orders);
  return products
    .filter(needsRestock)
    .map((p) => toRestockAlert(p, onOrder.get(p.id) || 0, policy))
    .sort((a, b) => a.criticality - b.criticality);
};

/*
| Fuente buena: una fila de POST /metrics/restock-suggestions. El backend ya
| decidió `should_restock` comparando la posición de inventario (disponible +
| en tránsito) contra el punto de reposición, así que acá no se decide nada: se
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
    suggestionSource: "backend",
    criticality:
      reorderPoint > 0 ? Math.min(1, Math.max(0, inventoryPosition / reorderPoint)) : 0,
  };
};
