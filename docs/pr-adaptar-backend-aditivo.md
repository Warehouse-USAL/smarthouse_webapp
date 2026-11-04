# PR — Adaptación del front al backend aditivo

> Rama: `feature/adaptar-backend-aditivo` | Base: `develop` | Fecha: 2026-11-03
> Alcance: front (React + Vite). No modifica backend.
> Este archivo reemplaza la documentación anterior de `docs/`.

---

## Objetivo

El backend incorporó una tanda de cambios **aditivos** (campos, endpoints y
códigos de error nuevos, sin romper contratos existentes). Esta rama adapta el
front para consumirlos, deja compatibilidad con el backend viejo donde aplica y
suma tests unitarios + un job de tests en CI.

---

## Qué hizo el backend

Los cambios que esta rama consume (contrato aditivo):

### Ajuste / modificación de stock

- `PATCH /warehouse/positions/{id}` acepta el campo opcional **`reason`**, que el
  backend persiste como motivo del ajuste (auditoría).
- La misma respuesta del `PATCH` devuelve **`cancelled_orders`** (array, `[]` si
  no hubo): son las órdenes de compra que el backend canceló por falta de stock
  al reducir, reconciliadas **en la misma transacción**. El front ya no necesita
  cancelarlas una por una.
- Códigos de error nuevos: `STOCK_CHANGE_CONFLICT`,
  `IDEMPOTENCY_REQUEST_IN_PROGRESS`, `DATABASE_UNAVAILABLE`.

### Órdenes de restock

- `RestockOrder` ahora tiene **`status`** y admite el estado **`CANCELLED`**.
- Campos nuevos: `expected_delivery_date`, `delivery_lead_time_days`,
  `cancelled_at`, `cancelled_by_user_id`, `cancellation_reason`.
- Endpoint nuevo: **`POST /restock/orders/{id}/cancel`** con body `{ reason }`.
  Errores 409: `RESTOCK_ORDER_ALREADY_CANCELLED`,
  `RESTOCK_ORDER_HAS_RECEPTIONS`, `RESTOCK_ORDER_CANCELLED`.
- El listado excluye las órdenes canceladas por defecto.

### Usuarios con rol proveedor

- Campo **`supplier`** en `CreateUserRequest`, `UpdateUserRequest` y
  `UserResponse`; obligatorio cuando el rol es `PROVIDER`.
- Errores: `PROVIDER_WITHOUT_SUPPLIER` (403) y `SUPPLIER_REQUIRED`.

---

## Qué corrigió esta rama (front)

| Commit | Cambio |
|---|---|
| `a3af80c` | **Reducción de stock**: `updatePosition` envía `reason` y devuelve el body del `PATCH`; el diálogo usa `cancelled_orders` del backend. `failShortOfStock` queda solo como fallback si la respuesta no trae esa clave (backend viejo). Se agregan mensajes comunes para los códigos nuevos. |
| `64189d3` | **Estado `CANCELLED` de restock**: se respeta el `status` del backend (se muestra "Cancelado"), se mapean fecha estimada y campos de cancelación, y las canceladas se excluyen de remitos y de órdenes abiertas. El filtro de estado no ofrece "Cancelado" porque el listado no las trae. |
| `9447e20` | **Proveedor en usuarios `PROVIDER`**: el formulario pide y exige `supplier`, se envía en alta/edición y se muestra como columna en la tabla. Se traducen los errores nuevos. |
| `436739a` | **Tests + CI**: se agrega `vitest` y el script `npm test`, más el job `Unit tests` en `.github/workflows/ci.yml`. 5 archivos de test (11 casos) sobre `apiError`, `orderService`, `restockService`, `userService` y `warehouseConfigService`. |

### Archivos tocados

- `src/lib/apiError.js` (+ test): mensajes comunes y orden de prioridad.
- `src/services/orderService.js` (+ test): `normalizeCancelledOrder`.
- `src/services/restockService.js` (+ test): estado `cancelado` y campos nuevos.
- `src/services/userService.js` (+ test): `supplier`.
- `src/services/warehouseConfigService.js` (+ test): `reason` y respuesta del PATCH.
- `src/pages/Products/ProductsPage.jsx`: uso de `cancelled_orders` + `reason`.
- `src/pages/StockManagement/StockManagementPage.jsx`: estado `cancelado`.
- `src/pages/Users/UsersPage.jsx` y `src/components/users/UserFormModal/UserFormModal.jsx`: proveedor.
- `.github/workflows/ci.yml`, `package.json`, `package-lock.json`: vitest + job de tests.

---

## Qué falta

### Backend

- **Kardex / historial de movimientos por producto**: no hay endpoint que
  exponga el historial de ajustes/movimientos. El `reason` se persiste, pero no
  se puede consultar ni mostrar todavía.
- **Nombre de cliente en `Order`**: solo llega `requested_by_user_id`; resolverlo
  cruzando con `userService` requiere rol `admin_system` (si no, la UI muestra
  "—").
- **Despacho manual de ventas**: el front no invoca el endpoint interno; la
  orden la completan los rovers vía Central.

### Front

- Mostrar en la UI la **auditoría del ajuste** (motivo + usuario + fecha) y el
  **kardex** cuando el backend los exponga.
- Verificar el contrato contra el backend real desplegado. Los endpoints se
  sacan del swagger: `http://localhost:8080/swagger-ui/index.html#/`.
- Actualizar el texto de fallback de cancelación de restock en
  `StockManagementPage.jsx`, que todavía dice "el backend no lo soporta".

---

## Verificación

- `npm run lint`: OK (0 errores).
- `vite build`: OK (216 módulos).
- Lógica de los services ejecutada contra los contratos nuevos: 17/17 asserts OK
  (`apiError`, `orderService`, `restockService`, `userService`,
  `warehouseConfigService`).
- `npm test`: el checkout local no tenía `vitest` instalado; la validación real
  es el job `Unit tests` del CI. Antes de mergear, confirmar que esté verde.

---

## Nota de merge

La rama quedó 2 commits atrás de `origin/develop` (backport `#46`/`#47`). No hay
conflicto esperado con los archivos de esta rama, pero conviene actualizarla
antes de mergear.
