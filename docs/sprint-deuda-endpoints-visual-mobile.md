# Sprint siguiente — Deuda de endpoints, visual y mobile

> Estado: planificado. Arranca una vez aprobado y mergeado el PR de
> `feature/adaptar-backend-aditivo` a `develop`.
> Base: `develop` actualizado. Rama sugerida: `feature/sprint-endpoints-visual-mobile`.
> Fecha: 2026-11-03

---

## Objetivo

Cerrar la deuda que quedó entre los endpoints/campos nuevos del backend y lo que
la UI muestra, ordenar las mejoras visuales pendientes y dejar la webapp usable
en mobile. No se modifica el backend salvo que se detecte un faltante y se
acuerde con el equipo de back.

---

## a) Deuda de endpoints nuevos (modificación de stock) — prioridad alta

**Problema:** el backend ya resuelve la modificación de stock (ajuste con
`reason`, cancelación de órdenes en la misma transacción vía
`cancelled_orders`, estado `CANCELLED` en restock), pero la UI todavía no le da
visibilidad completa a esa información.

**Tareas:**

- [x] Confirmar el contrato exacto de los endpoints y campos nuevos antes de
      consumirlos. La fuente de verdad es el swagger del backend:
      `http://localhost:8080/swagger-ui/index.html#/`.
- [x] Mostrar la **auditoría del ajuste de stock**: motivo, usuario y fecha
      (hoy el front envía `reason` pero no lo vuelve a leer ni lo muestra).
- [x] Consumir y mostrar el **historial de movimientos / kardex por producto**
      (`GET /products/{id}/stock-adjustments` ya existe; ver
      `docs/resuelto-sprint.md`).
- [x] Mostrar en el detalle las **órdenes canceladas por reducción de stock**
      (`cancelled_orders`) con su motivo y código, de forma consistente con el
      modal actual de reducción.
- [x] Revisar que no queden llamadas a contratos viejos: el fallback a backend
      viejo debe quedar solo como compatibilidad, no como camino principal.
- [x] Actualizar el texto de fallback de cancelación de restock en
      `StockManagementPage.jsx` (hoy dice que el backend no lo soporta).
- [x] Dejar documentado el contrato consumido en `docs/resuelto-sprint.md`.

**Criterio de aceptación:** hacer un ajuste de stock con motivo y poder ver,
desde la UI, el motivo, el usuario y la fecha; al reducir por debajo de la
reserva, ver las órdenes canceladas por el backend con su motivo. Sin datos
inventados: si falta un endpoint, se marca como pendiente de backend.

---

## a.2) Sugerencias de restock (`/metrics/restock-suggestions`) — prioridad alta

**Hallazgo verificado (2026-11-04, backend local :8080):** el endpoint responde
`200` y el contrato coincide con el front, pero la tabla de alertas queda vacía
porque el backend devuelve `should_restock: false` en todos los productos. No es
un bug del endpoint: es la regla de cálculo.

**Fórmula real** (`wh-backend/.../service/metrics/restock/RestockFormula.java`):

```
blended        = alpha * recent_demand + (1 - alpha) * long_term_demand
safety         = long_term_demand * safety_days
reorder_point  = blended * lead_time_days + safety
target_stock   = blended * (lead_time_days + coverage_days) + safety
position       = available + on_order
gap            = ceil(max(0, target_stock - position))
should_restock = position <= reorder_point && gap > 0
```

La demanda sale de **órdenes no canceladas** creadas dentro de la ventana
(`recent_days` / `long_days`). Sin ventas, `demand = 0`, entonces
`reorder_point = 0`, `target_stock = 0` y `gap = 0`: **no repone ni con stock en
0** (`0 <= 0` se cumple, pero `gap > 0` no).

**Segundo problema, en el front:** `listAlerts` devuelve `[]` (array vacío)
cuando todas las filas tienen `should_restock: false`, no `null`. En
`StockManagementPage.jsx:181`, `suggested ?? buildRestockAlerts(...)` no cae al
fallback porque `[]` no es `null`, y `hasSuggestions` queda en `true`
(`suggested !== null`). Resultado: tabla vacía y estado inconsistente.

**Diferencia de criterios a resolver con negocio:**

- La UI/negocio mira `stock.available < stock.min` (mínimo).
- El backend mira `inventory_position <= reorder_point` (demanda proyectada).
- `on_order_stock` evita reponer lo que ya viene en camino (ej. MOU-010 con 165
  y TAL-001 con 140 no se marcan aunque el disponible sea 0).

**Tareas:**

- [ ] Decidir la regla de negocio: (a) el backend usa `minimum_stock` como piso
      del `reorder_point` o marca `available < min`; (b) el front mergea las
      alertas locales de bajo mínimo con `suggested_quantity: null`; (c) se
      acepta que sin demanda no hay sugerencia y el operador carga a mano.
- [ ] Corregir en `listAlerts` / `StockManagementPage` el manejo de `[]` vs
      `null` y el cálculo de `hasSuggestions`, para que el fallback local corra
      cuando corresponda o se muestre un estado vacío explícito.
- [ ] Verificar con datos reales (curls de abajo) que con demanda > 0 el
      endpoint devuelve `should_restock: true` y `suggested_quantity > 0`.
- [ ] Documentar la fórmula y la diferencia `minimum_stock` vs `reorder_point`.
- [ ] Revisar el estado vacío de la tabla: hoy no distingue "no hay nada que
      reponer" de "el backend no calculó".

**Criterio de aceptación:** con un producto bajo mínimo y sin demanda, la UI
muestra una decisión explícita (alerta por mínimo con cantidad manual, o mensaje
de que la sugerencia depende de la demanda), y con demanda real el backend
devuelve `should_restock: true` verificado por curl.

**Verificación con curls (demanda sintética):**

> Requiere `jq` y rol `SUPERADMIN` o `ADMIN_WAREHOUSE` (el `PATCH` de posición y
> `/metrics/*` lo exigen; las órdenes aceptan además `ADMIN_SALES`/`OPERATOR`).
> Reemplazar `EMAIL`, `PASSWORD` y, si hace falta, `SKU`. El script sube stock a
> una posición, crea órdenes (demanda reciente) y vuelve a consultar la métrica.
> Las órdenes quedan `PENDING` y reservan stock: para deshacer, cancelarlas con
> `POST /orders/{id}/cancel`.

```bash
BASE=http://localhost:8080
EMAIL="admin@usal.com"
PASSWORD="..."
SKU="TAL-001"
GOAL=${GOAL:-30}

TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.token')
AUTH="Authorization: Bearer $TOKEN"

PRODUCT_ID=$(curl -s "$BASE/products?search=$SKU&size=5" -H "$AUTH" \
  | jq -r --arg sku "$SKU" '.products[] | select(.sku==$sku) | .id')
echo "producto: $PRODUCT_ID"

POS=$(curl -s "$BASE/warehouse/positions" -H "$AUTH" \
  | jq -c --arg p "$PRODUCT_ID" \
    '.positions[] | select(.product_id==$p and .is_active) | {id:.id_position,max:.maximum_capacity,current:.current_stock,size:.size_stock_to_save}' \
  | head -1)
POS_ID=$(echo "$POS" | jq -r .id)
POS_MAX=$(echo "$POS" | jq -r .max)
POS_CUR=$(echo "$POS" | jq -r .current)
POS_SIZE=$(echo "$POS" | jq -r .size)
echo "posición: $POS_ID (máx $POS_MAX, actual $POS_CUR, $POS_SIZE)"
if [ -z "$POS_ID" ] || [ "$POS_ID" = "null" ]; then
  echo "sin posición asignada a $SKU; ajustar a mano"
  exit 1
fi

VOL_MAX=$(curl -s -X POST "$BASE/warehouse/positions/validate-fit" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"product_id\":\"$PRODUCT_ID\",\"quantity\":$POS_MAX,\"size\":\"$POS_SIZE\"}" \
  | jq -r '.max_quantity_allowed')
[ "$VOL_MAX" = "null" ] && VOL_MAX=$POS_MAX

CAP=$(( POS_MAX < VOL_MAX ? POS_MAX : VOL_MAX ))
[ "$CAP" -lt 1 ] && { echo "sin capacidad para $SKU; ajustar a mano"; exit 1; }
STOCK=$(( POS_CUR > GOAL ? POS_CUR : GOAL ))
[ "$STOCK" -gt "$CAP" ] && STOCK=$CAP
echo "stock objetivo: $STOCK"

if [ "$STOCK" -ne "$POS_CUR" ]; then
  curl -s -X PATCH "$BASE/warehouse/positions/$POS_ID" -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"current_stock\":$STOCK,\"reason\":\"demanda sintética restock\"}" \
    | jq -c '{current_stock,maximum_capacity}'
fi

MAX_ORDER=$(curl -s "$BASE/products/$PRODUCT_ID" -H "$AUTH" \
  | jq -r '.product.order_constraints.max_quantity_per_order // 10')
[ "$MAX_ORDER" -le 0 ] && MAX_ORDER=10
LEFT=$STOCK
while [ "$LEFT" -gt 0 ]; do
  Q=$(( LEFT < MAX_ORDER ? LEFT : MAX_ORDER ))
  curl -s -X POST "$BASE/orders" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"quantity\":$Q}],\"destination_area\":\"Ventas\",\"address\":{\"street\":\"Calle Falsa 123\",\"postal_code\":\"5000\"},\"priority\":\"medium\"}" \
    | jq -c '.order | {id,status}'
  LEFT=$((LEFT - Q))
done

curl -s -X POST "$BASE/metrics/restock-suggestions" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"params\":{\"alpha\":0.3,\"recent_days\":7,\"long_days\":60,\"safety_days\":2,\"lead_time_days\":5,\"coverage_days\":7},\"filters\":{\"product_ids\":[\"$PRODUCT_ID\"]}}" \
  | jq '.data[] | {sku,available_stock,on_order_stock,inventory_position,reorder_point,target_stock,should_restock,suggested_quantity}'
```

> Para persistir el resultado en `product.restock` (lo que lee la UI sin request
> extra), correr además `POST /metrics/restock-suggestions/apply` con el mismo
> `params` y sin `filters`.

---

## b) Mejoras visuales — prioridad media

**Problema:** quedaron mejoras de UI/UX pendientes del sprint anterior y otras
que surjan de la revisión de negocio.

**A definir con negocio/UX** (lista preliminar a confirmar):

- [ ] Unificar los modales restantes al patrón `Modal` compartido (`RemitoModal`,
      `LocateReceptionModal`, modales de warehouse/usuarios).
- [ ] Datos de stock en la ficha de producto: disponible, reserva, físico real y
      badge de "Reponer".
- [ ] Columna "Ya pedido" / "(+N en camino)" usando `onOrderStock`.
- [ ] Preview automático de cantidad sugerida en la nueva orden de restock.
- [ ] Capturas pixel-perfect pendientes de las pantallas de Stock y Productos
      (1600 / 1366 / 768 / 375 px).
- [ ] Consistencia de design tokens, espaciados y tipografía.

**Criterio de aceptación:** cada mejora acordada queda implementada sin cambiar
comportamiento funcional y con captura antes/después.

---

## c) Mobile — prioridad baja

**Problema:** la app está pensada para desktop; en mobile puede romperse o
desbordar.

**Tareas:**

- [ ] Revisar todas las pantallas en 375 px y 768 px.
- [ ] Tablas: scroll horizontal controlado o apilado de filas; evitar desbordes
      del contenedor.
- [ ] Navegación (navbar/menú) usable en mobile.
- [ ] Modales: ancho, padding y scroll interno correctos.
- [ ] Formularios: inputs y botones a ancho completo cuando corresponda.
- [ ] Verificar que no haya scroll horizontal global.

**Criterio de aceptación:** ninguna pantalla se rompe ni genera scroll
horizontal en 375 px y 768 px; las acciones principales siguen accesibles.

---

## Orden sugerido

1. **a) y a.2)** Deuda de endpoints de stock y sugerencias de restock (alto
   impacto funcional).
2. **b)** Mejoras visuales acordadas con negocio.
3. **c)** Mobile (baja prioridad, al final).

---

## Fuera de alcance / pendientes heredados

- **Kardex**: desbloqueado. El backend expone
  `GET /products/{id}/stock-adjustments`; ya se consume (ver
  `docs/resuelto-sprint.md`).
- **Despacho manual de ventas**: depende de la decisión del backend.
- **Nombre de cliente en `Order`**: requiere `admin_system` o un join del
  backend.
