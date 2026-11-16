# Auditoría de endpoints — front ↔ swagger

> Fecha: 2026-10-07 | Fuente: `docs/backend-openapi.json` + verificación en vivo contra el backend local (`:8080`, `admin@usal.com`).
> Alcance: todas las llamadas de tablas, grillas, modales y services del front (`src/**`, sin mocks).

---

## 1. El front llama a endpoints que NO existen en el swagger

1. **`POST /restock/orders/{id}/cancel`** — `restockService.cancelOrder` (`src/services/restockService.js:351`), botón "Cancelar orden" de `StockManagementPage.jsx:350`.
   - Swagger: no lo declara (sprint punto 4, ⛔ backend).
   - En vivo devuelve **401** (no 404 como asume el comentario del service).
   - Impacto: `apiClient` (`src/lib/apiClient.js:21`) borra `token`/`user` ante **cualquier 401** → quien use el botón queda **deslogueado**. Hoy el `catch` muestra "El backend todavía no soporta…", pero la sesión ya se perdió.
   - Acción: backend debe crear el endpoint; mientras, el front debería dejar de ofrecerlo (o blindar esta llamada).
2. **`PATCH /vehicles/{id}`** y **`DELETE /vehicles/{id}`** — existen en `vehicleService` (`src/services/vehicleService.js:48,54`) pero **ninguna página los usa** (`VehiclesPage` solo `list()` y `register()`).
   - Swagger: `PATCH` existe solo como `PATCH /internal/vehicles/{id}` (en vivo: interno → 404 recurso; público → 401). `DELETE` no existe en ninguna variante.
   - Acción: decidir si se borran los métodos sin uso o se alinean a `/internal`.

## 2. Endpoints declarados en el swagger que el front NO usa

- `PATCH /internal/orders/{id}/status` y `PATCH /internal/orders/{id}/assign-vehicle` — despacho manual / asignación de rover. La UI solo informa (modal de despacho en `SalesPage`). Pendiente de decisión de negocio (sprint §11, punto 11).
- `POST /orders` — no hay UI para crear una orden de venta (Ventas solo lista y cancela).
- `PATCH /users/me` y `POST /users/me/change-password` — no hay página de perfil.
- `DELETE /api/v1/files/{path}/{file}` — al reemplazar o eliminar la imagen de un producto el archivo queda en MinIO (el upload `POST /api/v1/files/upload` sí se usa; el `GET` lo sirve el navegador vía `<img>`).
- `POST /query/{entity}`, `POST /metrics/query`, `POST /metrics/restock-suggestions/apply` — el front solo usa `GET /query/catalog`, `GET /metrics/catalog` y `POST /metrics/restock-suggestions` (descubrimiento por catálogo en `restockService`).
- `DELETE /warehouse/positions/{id}` — el front desactiva posiciones (`is_active=false`) en vez de borrarlas.
- `GET /warehouse/positions` (listado global) — el front recorre zonas → líneas → posiciones.

## 3. Conecta bien (verificado contra el swagger)

- Login: `POST /auth/login`.
- Listados paginados vía `fetchAllPages`: `GET /products`, `/orders`, `/restock/orders`, `/restock/receptions`, `/users`, `/vehicles`.
- Productos: `GET/POST/PATCH/DELETE /products`, `GET /products/{id}/location`, `GET /products/categories`, imagen vía `POST /api/v1/files/upload`.
- Venta: `GET /orders/{id}`, `POST /orders/{id}/cancel` (pendiente/in_progress → cancelled).
- Restock: `GET /restock/orders/{id}`, `POST /restock/orders`, `GET /restock/receptions/{id}`, `POST /restock/receptions`, `PATCH /restock/receptions/{id}`.
- Almacén: zonas/líneas/posiciones CRUD (alta, edición, `is_active`), `GET /warehouse/positions/{id}`, `/available`, `POST /warehouse/positions/validate-fit`, `unassign_product`.
- Usuarios: `GET/POST/PATCH /users`, `POST /users/{id}/reset-password`.
- Métricas / catálogo: `GET /metrics/catalog` → `POST /metrics/restock-suggestions`; `GET /query/catalog` (soporte de `status` en recepciones).

## 4. Deuda de backend dentro del alcance del sprint (lo único que falta)

Dejando de lado vehículos, archivos y perfil, para cerrar el sprint el backend debe:

1. **Punto 4 — Cancelar orden de restock**: `POST /restock/orders/{id}/cancel` **y** el campo `status` en `RestockOrder` (el schema ni siquiera está declarado en el swagger). Solo el endpoint sin `status` no alcanza: no habría estado `cancelled` que mostrar. Efecto colateral hoy: esa llamada responde 401 → `apiClient` borra la sesión (usuario deslogueado).
2. **Punto 9 — Ventas**: ya están `GET /orders` ✔ y `PATCH /internal/orders/{id}/status` (despacho manual) ✔. **Falta el cliente en `Order`**: solo trae `requested_by_user_id`; el nombre se resuelve cruzando con `userService`, pero requiere rol `admin_system` (si no, la UI muestra "—").
3. **Punto 10 — Inventario/ajuste**: **auditoría del ajuste** (motivo + usuario + fecha — `UpdatePositionRequest` no los persiste) y **kardex / historial de movimientos por producto** (no existe endpoint).
