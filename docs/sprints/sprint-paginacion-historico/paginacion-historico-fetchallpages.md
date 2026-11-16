# Paginación de histórico: carga completa de /orders y /restock con topes de 1.000 registros

## Problema

Con el nuevo seed de datos del backend se generó **2 años de historial sintético**:
- `orders`: ~56.799
- `restock_orders`: ~2.081

Las pantallas actuales fuerzan la **descarga completa** del listado para paginarlo localmente. Ambos servicios usan `fetchAllPages` con un tope artificial:

```js
const MAX_PAGE_SIZE = 50;
const MAX_PAGES = 20;  // máximo 1.000 registros
```

Esto provoca dos comportamientos distintos:

- **Gestión de Ventas (`/orders`)**: `orderService.list()` itera hasta 20 páginas y, al superar los 1.000 registros, lanza `Error("El listado /orders supera los MAX_PAGES * MAX_PAGE_SIZE registros; hay que paginar la pantalla.")`. En la carga inicial puede verse como si "se quedara cargando para siempre" según timing/red, pero el tope se alcanza.
- **Gestión de Stock → Restock (`/restock/orders`)**: `restockService.fetchAllRestockOrders()` también usa `fetchAllPages` con el mismo tope. Con ~2.081 registros supera los 1.000 y **tira error al pasarse del tope**, tal como reportó el equipo de backend.

## Causa raíz

El frontend está **paginando del lado del cliente pero descargando TODO el dataset primero**. El patrón `fetchAllPages` (traer todas las páginas disponibles hasta un límite) es válido para listados pequeños, pero dejó de escalar con 2 años de historial.

Archivos implicados:

- `src/services/orderService.js` – `list()` usa `fetchAllPages('/orders', filters, 'orders', normalize)`. Define `MAX_PAGE_SIZE=50`, `MAX_PAGES=20` (líneas ~30–110).
- `src/services/restockService.js` – `fetchAllRestockOrders()` usa `fetchAllPages` con el mismo tope (líneas ~200–230).
- `src/pages/Sales/SalesPage.jsx` – realiza paginación **local** (`filtered.slice(...)`) con `pageSize` 8/16/32 (líneas ~210–215). Primero carga todo vía `orderService.list()`.
- `src/pages/StockManagement/StockManagementPage.jsx` – espera `restockOrders` completo (traído por `fetchAllRestockOrders`) y aplica filtros/paginación local.

## Comportamiento observado

- Ventas: intenta traer las 20 primeras páginas (1.000) pero hay 56k. Se alcanza el límite de `fetchAllPages` y se lanza excepción. Dependiendo del try/finally puede percibirse como "carga infinita".
- Restock: supera 1.000 → `fetchAllPages` termina lanzando error "supera los MAX_PAGES * MAX_PAGE_SIZE registros; hay que paginar la pantalla".

## Solución propuesta

Migrar a **paginación servidor-side**: enviar `page`, `size` (y filtros `from`, `to`, `status`, `vehicleId`, etc.) al backend, y usar `pagination.totalPages`/`totalElements` para renderizar controles. 

Acciones concretas:

### A) Gestión de Ventas
1. Extender `orderService` para exponer un método que acepte `page/size` (o modificar `list` para aceptar params de paginación). Mantener compatibilidad con mocks.
2. Refactorizar `SalesPage` para:
   - Mantener `currentPage`, `pageSize` en estado.
   - Enviar `page`, `size` al backend en cada cambio (filtros, búsqueda, cambio de página/tamaño).
   - Usar `totalPages` devuelto por backend (no calcular `Math.ceil(filtered.length / pageSize)` sobre array completo).
3. (Recomendado) Aplicar **filtro por fecha por defecto** (p.ej. `últimos 90 días`) para reducir la carga inicial con 2 años de histórico. El filtro actual arranca vacío (`{ from: "", to: "" }`).

### B) Gestión de Restock
1. Dejar de usar `fetchAllRestockOrders()` (trae todo hasta 1.000). Crear/usar métodos que acepten `page/size` y devuelvan respuesta paginada.
2. Refactorizar `StockManagementPage` para paginar servidor-side en la pestaña "Pedidos a proveedor" (restock orders). Evaluar también "Recepciones" según contrato backend.
3. Subir el tope **solo como parche temporal** no escala (con 56k sigue siendo inviable). Mejor migrar a paginación servidor.

### C) Consideraciones
- El backend responde con estructura paginada (ver `restockService.fetchAllPages`: espera `data.content`/`data.orders` + `data.pagination.total_pages`). Mantener normalización consistente.
- No eliminar `fetchAllPages` de golpe si otros listados lo usan, pero **no usarlo para "traer todo"** en pantallas con gran volumen.
- Con paginación servidor, filtros por fecha deben seguir enviándose al backend (evita descargar 2 años).

## Criterios de aceptación (sugeridos)

- [ ] `SalesPage` pide **solo la página actual** al backend (envía `page`, `size`).
- [ ] Se muestran `totalElements`/`totalPages` correctos desde respuesta paginada.
- [ ] Al cambiar filtros de fecha/estado/búsqueda se vuelve a página 1.
- [ ] `StockManagementPage` deja de intentar traer 2k registros de golpe (paginación servidor o tope acorde). 
- [ ] Si se mantiene `fetchAllPages`, queda **restringido** a casos donde realmente se justifica (con aviso/validación).
- [ ] Carga inicial con filtro por defecto (p.ej. últimos 90 días) reduce tiempo de respuesta.

## Referencias rápidas

- `orderService.js:82–110` – `fetchAllPages` + tope 1000
- `orderService.js:126–135` – `list()` usando `fetchAllPages`
- `restockService.js:200–230` – `fetchAllRestockOrders()` con `fetchAllPages`
- `SalesPage.jsx:140–155` – carga inicial `orderService.list()`
- `SalesPage.jsx:210–215` – paginación local
- `StockManagementPage.jsx:230–290` – carga y uso de `restockOrders`

## Prioridad

**Alta** – bloqueante con el nuevo seed (Ventas supera tope, Restock lanza error). Conviene revisar para el **próximo sprint**.