# Resuelto — Sprint deuda de endpoints de stock

> Fecha: 2026-11-04
> Rama: `feature/sprint-endpoints-visual-mobile`
> Alcance: bloque **a)** de `docs/sprint-deuda-endpoints-visual-mobile.md`.
> Los bloques a.2 (sugerencias de restock), b (visual) y c (mobile) siguen
> pendientes.

---

## 1. Qué se hizo

- Se verificó el contrato real de los endpoints de ajustes de stock contra el
  swagger local (`http://localhost:8080/v3/api-docs`) y el backend.
- Se agregó un servicio de lectura del **historial de ajustes por producto**
  (`GET /products/{id}/stock-adjustments`).
- Se agregó en Productos un **modal de historial** con fecha, tipo, motivo,
  usuario, cambio de cantidad y órdenes canceladas.
- El modal de reducción ahora muestra el **motivo** de cada orden cancelada,
  además del código y el estado.
- Se actualizó el texto obsoleto de cancelación de restock en
  `StockManagementPage.jsx`.

---

## 2. Contrato verificado

### 2.1 Endpoints

| Método | Ruta | Uso en el front | Estado |
| --- | --- | --- | --- |
| `PATCH` | `/warehouse/positions/{id}` | Aplicar ajuste (`current_stock` + `reason` opcional) | Usado (sin cambios) |
| `GET` | `/products/{id}/stock-adjustments?page&size` | Historial/kardex del producto | **Nuevo** |
| `GET` | `/warehouse/positions/{id}/stock-adjustments?page&size` | Historial por posición | No usado |
| `POST` | `/warehouse/positions/{id}/stock-adjustments` | Reducción con tipo (`DAMAGE`, etc.) | **No integrado** (ver §4) |

`PATCH /warehouse/positions/{id}` ya registra el ajuste en el historial: el
backend guarda el `reason` y el usuario del JWT. La UI no necesita un endpoint
extra para escribir, solo para leer. El `reason` lo escribe el operador en el
modal; si lo deja vacío se envía un resumen automático para no perder contexto.

El `page` de los `GET` es **zero-indexed**; `fetchPage` traduce la página
1-based de la UI a 0-based y limita `size` a 50.

### 2.2 Registro de ajuste (`stock_adjustments[]`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | string | |
| `position_id` | string | |
| `product_id` | string | |
| `type` | enum | Ver §2.3 |
| `reason` | string \| null | Texto libre cargado por el usuario |
| `quantity_before` | int | |
| `quantity_after` | int | |
| `adjusted_by` | string | **Id** del usuario (subject del JWT) o `system` |
| `created_at` | ISO date-time | |
| `cancelled_order_ids` | string[] | Órdenes canceladas por ese ajuste |

### 2.3 Enum `StockAdjustmentType`

| Valor | Etiqueta en la UI |
| --- | --- |
| `MANUAL_INCREASE` | Entrada manual |
| `MANUAL_DECREASE` | Baja manual |
| `DAMAGE` | Rotura / daño |
| `UNASSIGNED` | Producto desasignado |
| `DEACTIVATED` | Posición desactivada |

### 2.4 Roles

| Endpoint | Roles |
| --- | --- |
| `PATCH /warehouse/positions/{id}` | `SUPERADMIN`, `ADMIN_WAREHOUSE` |
| `GET /warehouse/positions/{id}/stock-adjustments` | `SUPERADMIN`, `ADMIN_WAREHOUSE` |
| `GET /products/{id}/stock-adjustments` | `SUPERADMIN`, `ADMIN_WAREHOUSE`, `ADMIN_SALES` |
| `POST /warehouse/positions/{id}/stock-adjustments` | `SUPERADMIN`, `ADMIN_WAREHOUSE` |

La UI replica esto con la capacidad `stock.history`.

### 2.5 Errores nuevos (`POST`)

| Código | Significado |
| --- | --- |
| `INVALID_QUANTITY` | Cantidad ≤ 0 o no entera |
| `INVALID_ADJUSTMENT_TYPE` | Tipo fuera del enum |
| `POSITION_WITHOUT_PRODUCT` | La posición no tiene producto asignado |
| `QUANTITY_EXCEEDS_POSITION_STOCK` | La cantidad supera el stock actual |

### 2.6 Órdenes canceladas (`cancelled_orders[]`)

| Campo | Tipo |
| --- | --- |
| `id` | string |
| `cancel_reason` | string (`INSUFFICIENT_STOCK: ...`) |
| `created_at` | ISO date-time |

Estas órdenes también quedan en estado `CANCELLED` en restock.

---

## 3. Cambios en el front

| Archivo | Cambio |
| --- | --- |
| `src/services/stockAdjustmentService.js` | **Nuevo.** `listProductAdjustments(productId, {page,size})` + `normalizeAdjustment`. Devuelve página vacía si `VITE_USE_MOCK=true`. |
| `src/services/stockAdjustmentService.test.js` | **Nuevo.** Normalización del registro y traducción 1-based → 0-based. |
| `src/lib/permissions.js` | Nueva capacidad `stock.history` (`SUPERADMIN`, `ADMIN_WAREHOUSE`, `ADMIN_SALES`). |
| `src/pages/Products/ProductsPage.jsx` | Botón de historial por producto, modal con tabla paginada, motivo editable en el ajuste y motivo en órdenes canceladas. |
| `src/pages/Products/ProductsPage.css` | Estilos del historial y del motivo de la orden cancelada. |
| `src/pages/StockManagement/StockManagementPage.jsx` | Fallback de cancelación de restock actualizado (ya no dice "el backend no lo soporta"). |

---

## 4. Decisiones y límites

- **Se mantiene el `PATCH` para aplicar ajustes.** Ya funciona, registra
  historial y es el que respeta el flujo actual de la UI (incluido el mock).
- **El motivo del ajuste es editable.** El modal tiene un campo
  "Motivo (opcional)"; si el operador lo completa, el `reason` enviado al
  `PATCH` queda como `<tipo>: <motivo>` (ej. `Rotura (-): caja aplastada`). Si
  lo deja vacío, se envía el resumen automático con SKU, posición y cambio.
- **No se integró el `POST /stock-adjustments`** en esta iteración. Sería el
  camino para registrar tipos explícitos como `DAMAGE` al reducir stock; queda
  como mejora futura. Hoy el `PATCH` mapea el tipo a
  `MANUAL_INCREASE`/`MANUAL_DECREASE`, pero el texto elegido se conserva en el
  prefijo del motivo.
- **El usuario se muestra como id** salvo que coincida con el usuario actual
  (se resuelve a nombre) o sea `system` (se muestra "Sistema"). No hay endpoint
  de usuarios accesible para `ADMIN_WAREHOUSE`.
- **`POST` vs `PATCH`:** el `POST` devuelve `{adjustment, cancelled_orders}`;
  `PATCH` devuelve `UpdatePositionResponse` con `cancelled_orders`. La UI ya
  consumía `cancelled_orders` del `PATCH`, así que no hubo que migrar.
- Sin datos simulados: si el `GET` falla, el modal muestra un error explícito.

---

## 5. Verificación

| Comprobación | Resultado |
| --- | --- |
| `curl http://localhost:8080/v3/api-docs` | `200`; endpoints y roles confirmados |
| `npm test` | 6 archivos, 21 tests OK |
| `npm run lint` | Sin errores |
| `npm run build` | Build OK |

---

## 6. Pendiente

- **a.2** Sugerencias de restock: decidir regla de negocio y corregir `[]` vs
  `null` en `listAlerts`.
- **b** Mejoras visuales: unificar modales, columna "Ya pedido", capturas.
- **c** Mobile: revisar 375 px / 768 px, tablas, navegación y modales.
- Opcional: migrar la reducción a `POST /warehouse/positions/{id}/stock-adjustments`
  para registrar `DAMAGE` u otros tipos y mostrar `quantity_before/after`
  devueltos por el backend.

---

## 7. Cómo probar a mano

1. Login con `SUPERADMIN` o `ADMIN_WAREHOUSE`.
2. Productos → ajustar stock de un producto; escribir el motivo en
   "Motivo (opcional)" (ej. "Rotura de caja"). Aplicar.
3. En la misma fila, abrir **Historial de ajustes** (ícono de lista).
4. Verificar: fecha, tipo, motivo, usuario, `antes → después` y órdenes
   canceladas (si la reducción dejó stock insuficiente).
5. Hacer una reducción que deje el stock por debajo de la reserva y comprobar
   que el modal de reducción lista las órdenes con su motivo
   (`INSUFFICIENT_STOCK: ...`).
