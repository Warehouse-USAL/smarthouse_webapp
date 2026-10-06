# Sprint — Gestión Stock / Ventas / UX Modales

> Rama sugerida: `feature/sprint-ventas-stock-ux` (alternativa: `feature/sprint-gestion-ventas-stock`)
> Fecha: 2026-10-05 | Proyecto: SmartWarehouse — App Web (React + Vite)
> Origen: relevamiento funcional + diseños super-detallados provistos por negocio. No se modifica backend salvo que se indique.

---

## 1. Logo no carga en servidor

### Problema actual
Al abrir la app desde el servidor (Warehouse-USAL vía Caddy, prefijo `/app`) la imagen del logo no aparece. En local (`npm run dev` → `http://localhost:5173`) sí se ve.

### Hipótesis
1. Path absoluto `/logo.png` que no respeta `BASE_URL=/app/`.
2. Uso de `src/assets` importado vs `public/` con ruta hardcodeada.
3. `vite.config.js` sin `base: '/app/'` para build prod.
4. `nginx.conf` / `Dockerfile` sin servir correctamente `/app` + assets.
5. Cache de `dist/` vieja en el servidor.

### Tareas
- [ ] Auditar dónde se usa el logo: `grep -r "logo" src/ public/ index.html vite.config.js nginx.conf Dockerfile`.
- [ ] Estandarizar: importar con `import logo from '@/assets/logo...'` o usar `${import.meta.env.BASE_URL}logo.png`.
- [ ] Verificar `vite.config.js`: `base: '/app/'` para prod.
- [ ] Verificar `BrowserRouter basename={import.meta.env.BASE_URL}` ya existe en `src/routes/AppRoutes.jsx` — replicar criterio para assets.
- [ ] Probar `npm run build && npm run preview` local con base `/app/`.
- [ ] Verificar en servidor: abrir DevTools → Network → ver 404 del logo, confirmar path pedido.
- [ ] Recargar imagen del logo en alta resolución (SVG preferido, fallback PNG 2x).

### Criterio de aceptación
Logo visible en `/app/inicio`, `/app/productos`, etc. sin 404 en Network, tanto en desktop como mobile.

### Pendiente negocio
Confirmar si Rodri pidió alguna pantalla más además de las de este sprint.

---

## 2. Gestión de Stock — igualar anchos

### Problema actual
En `/gestion-stock` el bloque `Productos con alerta de restock` tiene distinto ancho que `Órdenes de restock`. Se ve desparejo.

### Requerimiento
Mismo ancho, misma grilla, mismos radios/bordes/sombras para ambas tarjetas/tablas. Si una colapsa en responsive, la otra colapsa igual.

### Tareas
- [ ] Inspeccionar `src/pages/StockManagement/StockManagementPage` + estilos.
- [ ] Unificar contenedor: mismo `max-width`, `padding`, `border: 1px solid #E5E7EB`, `border-radius: 12-16px`.
- [ ] Verificar en 1600px, 1366px, 768px, 375px.

### Criterio de aceptación
Captura lado a lado: ambas tarjetas alineadas pixel-perfect.

---

## 3. Alta — ARS fijo sin posibilidad de cambio

### Requerimiento confirmado
Mantener ARS como aparece ahora pero **sin permitir cambiarlo**. No es selector, es valor fijo.

### Alcance
Aplica al alta de producto y a la creación de orden de restock / remito (todo lo que hoy muestre moneda).

### Tareas
- [ ] Reemplazar `<select moneda>` por texto fijo `ARS` o select `disabled` con único option `ARS`.
- [ ] Hardcodear `currency: 'ARS'` en payload (`productService.js`, `restockService.js`).
- [ ] Validación frontend: si llega otra moneda, bloquear submit.
- [ ] Quitar opciones USD / otras del UI y de mocks (`src/services/mocks/`).

### Criterio de aceptación
No existe forma por UI de cargar otra moneda que no sea ARS.

---

## 4. Cancelar una orden de restock

> Nota (Backend §3.5 + RFC Restock §9): `RestockOrder` hoy no tiene `status` ni cancelación — es registro histórico simple. El `POST /orders/:id/cancel` y los estados `pending/in_progress/cancelled` de §11 son de `Order` (despacho al cliente / ventas, punto 9), no de restock. Este punto queda bloqueado hasta que negocio defina lifecycle de `RestockOrder`; si se refiere a cancelar `Order`, aplica al flujo de ventas.

### Requerimiento
Agregar opción de cancelar una orden de restock en estado pendiente.

### Flujo
1. Usuario abre orden → Modal Acciones (punto 7) → clic `Cancelar orden`.
2. Confirmación (doble paso para evitar clic accidental).
3. `POST /orders/:id/cancel` con `{ reason }`.
4. UI actualiza a `cancelled`, muestra badge rojo, registra `cancel_reason` y fecha.

### Tareas
- [ ] Botón `Cancelar orden` outline rojo + icono tacho (coherente con alerta).
- [ ] Modal confirm: motivo obligatorio (select: `Ya no es necesaria / Stock incorrecto / Duplicada / Otro` + textarea).
- [ ] Integrar `restockService.cancelOrder(id, reason)` / `orderService`.
- [ ] Manejar errores: ya `in_progress` con rover asignado, sin permiso `admin_warehouse/admin_sales`.
- [ ] Refrescar lista + métricas.

### Criterio de aceptación
Orden pendiente se puede cancelar con motivo, cambia a cancelada y queda trazabilidad.

---

## 5. Datos de stock en ficha: disponible / reserva / físico real / reponer

### Requerimiento
Mostrar en producto: disponible, cantidad en reserva, stock físico real, y si hay que reponer o no.

### Definiciones
- `stock_fisico`: unidades físicamente en warehouse.
- `reserva`: unidades comprometidas en órdenes `pending/in_progress` no despachadas.
- `disponible = fisico - reserva` (nunca negativo en UI, mostrar 0 + alerta si inconsistente).
- `necesita_reposicion = disponible < stock_minimo`.
- `cantidad_sugerida`: ej. llevar hasta `stock_objetivo` o `minimo * factor`.

### Tareas
- [ ] Extender card/tabla producto con 4 columnas/badges.
- [ ] Badge `Reponer: Sí (rojo/naranja) / No (verde/gris)`.
- [ ] Tooltip explicando fórmula.
- [ ] Si backend no devuelve `reserva`, calcularla agregando órdenes pendientes por `product_id` o pedir campo (preferible calcular en front por ahora).

### Ejemplo
Mouse inalámbrico SKU MOU-001: físico 12, reserva 7, disponible 5, mínimo 20 → Reponer: SÍ, sugerido 50.

---

## 6. Sistema único de modales con variaciones

### Problema
La info muchas veces es la misma pero cada modal se ve distinto. No gusta.

### Requerimiento
Un único formato `BaseModal` que admita variaciones (con/sin gráficos, distinto contenido) pero unifique lo común.

### Spec `BaseModal`
- Overlay: fondo oscuro azulado/violáceo con blur (`rgba(30,41,82,0.45) + backdrop-filter: blur(6px)`).
- Contenedor: blanco, `border-radius: 20-24px`, `box-shadow: 0 24px 64px rgba(0,0,0,0.18)`, `max-width: 640px` (sm 480, lg 800 para gráficos), `padding: 28-32px`.
- Header: título 20px negrita `#111827` izquierda + X cierre gris sin borde + subtítulo 14px azul `#3B82F6/#4F63D2` en voseo.
- Bloques: `CardProducto`, `InfoGrid 2col`, `Alerta`, `Footer` (botones derecha: secundario + primario/destructivo).
- Tipografía Inter/system sans, etiquetas 12px gris `#6B7280`, valores 14-15px `#111827`.

### Tareas
- [ ] Crear `src/components/ui/BaseModal/BaseModal.jsx + .css`.
- [ ] Crear subcomponentes: `ProductCard`, `InfoGrid`, `AlertBanner`, `ModalFooter`.
- [ ] Migrar: Acciones restock, Nueva orden restock, Agregar remito, Ver detalle venta.
- [ ] Storybook/manual de uso en este doc.

---

## 7. Modal "Acciones de orden de restock" — SPEC LITERAL

> Diseño provisto super-detallado. Implementar pixel-perfect sobre `BaseModal`.

**Visión general:** modal centrado fondo blanco, esquinas bastante redondeadas, sombra suave, fondo desenfocado azulado/violáceo. Limpio, aireado, jerarquía: encabezado → tarjeta producto → info orden → alerta → botonera. Sans-serif moderna tipo Inter.

**Encabezado:** Título "Acciones de orden de restock" negrita casi negro izquierda. X gris arriba derecha sin fondo. Subtítulo azul medio: "Visualizá los detalles de la orden y podés cancelarla si ya no es necesaria." (voseo).

**Tarjeta producto** (borde gris clarito, 3 zonas):
1. Imagen izq: foto mouse inalámbrico negro en perspectiva, recuadro gris azulado suave redondeado, centrado.
2. Centro: Etiqueta "Producto" gris chico. Nombre "Mouse inalámbrico" negrita grande (lo más destacado). "SKU: MOU-001" gris menor. Icono caja en recuadro gris + "Categoría: Periféricos".
3. Derecha métricas verticales con iconos azul/gris (cajas, caja-flecha, barras): Stock actual: 5 unidades / Stock mínimo: 20 unidades / Cantidad sugerida: 50 unidades. Texto gris chico.

**Sección "Información de la orden":** título negrita fuera del recuadro. Recuadro borde gris suave, 2 col x 3 filas, etiqueta gris arriba / valor negro abajo:
| Izq | Der |
| N° orden: RST-00024 | Estado: ● Pendiente (naranja, sin fondo) |
| Fecha creación: 19/05/2024 10:30 | Fecha estimada: 22/05/2024 |
| Cantidad solicitada: 50 unidades | Observaciones: - |
Línea vertical sutil entre columnas.

**Alerta:** banner rosa/rojo claro, borde rojizo fino, icono círculo-exclamación rojo. Texto rojo oscuro 2 líneas: "Esta orden aún no tiene un remito de recepción registrado. Si ya no es necesaria, podés cancelarla."

**Footer derecha:** "Cerrar" secundario blanco borde gris texto negro negrita + "Cancelar orden" outline blanco borde/texto rojo + icono tacho izquierda.

**Paleta/UX:** blanco base, grises secundarios, azul subtítulo/iconos, naranja pendiente, rojo destructivo. Nombre producto y valores prominentes. Outline (no sólido) para bajar riesgo clic accidental. Todo voseo.

### Tareas
- [ ] Implementar con `BaseModal` + datos reales (`orderId`, `product`, `timestamps`).
- [ ] Estado `Pendiente` naranja con dot; si `cancelled` pasar a rojo (punto 9).
- [ ] `Observaciones: -` cuando vacío.
- [ ] Conectar `Cancelar orden` con punto 4.

---

## 8. Modal nueva orden restock — incluir imagen al seleccionar producto

### Requerimiento
Cuando se selecciona producto, mostrar imagen como en modal agregar remitos de recepción.

### Tareas
- [ ] Reutilizar `ProductCard` / thumb 48-64px + nombre + SKU + stock actual/mínimo.
- [ ] Si producto sin imagen, placeholder con icono caja gris.
- [ ] Preview actualiza cantidad sugerida automáticamente.

---

## 9. Nueva sección: Gestión de Ventas — SPEC LITERAL

> Pantalla "Gestión de Ventas" (SmartWarehouse), versión con SKU. Textos aproximados sobre captura 1600px. Colores por tono.

**Visión:** dashboard blanco limpio. 4 bloques: nav, encabezado, 3 cards métricas, tabla órdenes. Naranja = marca/acciones. Azul índigo = secundarios + Despachado. Verde = métrica total (Cancelada pasa a ROJO por decisión, ver abajo). Grises claros bordes.

**Nav:** blanco sombra sutil. Logo hexágono naranja + caja-flecha + "SmartWarehouse" 22px negrita. Links 13px gris medio: Inicio, Productos, Gestión stock, Gestión Ventas (activa naranja + línea), Asignación Ubicación, Configuración warehouse, Vehículos. Usuario avatar circular + "User 1" 15px semibold + chevron.

**Encabezado:** "Gestión de Ventas" 30px negrita. Subtítulo periwinkle 15px 2 líneas voseo: "Visualizá y gestioná las órdenes de compra realizadas por tus clientes. / Marcá como despachadas las órdenes para actualizar el stock de reserva."

**3 cards** (misma fila, tintadas, icono cuadrado pastel izq + texto der):
1. Crema/durazno: carrito naranja — "Órdenes pendientes de despacho / 12" (sin sublabel, etiqueta 14-16px, número 32-34px negrita).
2. Celeste: cubo 3D azul — "Órdenes despachadas / 48 / Últimos 30 días" (sublabel gris 13px).
3. Menta: calendario verde — "Total de órdenes / 60 / Últimos 30 días".

**Tabla "Órdenes de compra":** contenedor blanco borde fino. Título 20px negrita. Buscador full-width lupa índigo placeholder "Buscar por número de orden, cliente o producto..." 13px periwinkle + botón "Filtros" blanco borde gris + embudo.

Columnas 12px semibold: Orden compra, Fecha compra, Cliente, Producto (+thumb 28px ferretería), SKU, Cantidad, Estado, Fecha despacho, Acciones. Filas 13px regular, separador gris invisible:
- OC-00056 19/05/2024 14:32 Distribuidora Sur Tornillo Phillips 3x20 TOR-320 150 Pendiente - [Marcar como despachado]
- OC-00055 19/05/2024 11:20 Ferretería Central Arandela M8 ARA-008 200 Pendiente - [Marcar]
- OC-00054 18/05/2024 16:45 Constructora Norte Tuerca M8 TUE-008 500 Pendiente - [Marcar]
- OC-00053 18/05/2024 10:15 Empresa Martínez Tornillo Allen 4x30 TOR-430 300 Despachado 18/05/2024 15:20 Ver detalle ›
- OC-00052 17/05/2024 09:40 Soluciones Industriales Perno Hex M10 PER-010 1000 Despachado 17/05/2024 14:10 Ver detalle
- OC-00051 17/05/2024 08:25 Ferretería Litoral Tarugo 8mm TAR-008 400 Cancelada 17/05/2024 09:00 Ver detalle
- OC-00050 16/05/2024 17:30 Obras y Más Tornillo Autoperf 4x16 TOR-416 750 Despachado 16/05/2024 18:00 Ver detalle
- OC-00049 16/05/2024 12:10 Materiales Express Tuerca M6 TUE-006 150 Pendiente - [Marcar]

**Badges píldora + dot 12px — DECISIÓN: Cancelada en ROJO (no verde):**
- Pendiente despacho: fondo naranja pastel, texto/dot naranja.
- Despachado: fondo celeste pastel, texto/dot azul.
- Cancelada: fondo rojo pastel, texto/dot rojo oscuro (cambia verde original que confundía con éxito).

**Acciones:** "Marcar como despachado" naranja sólido + camión blanco 12px semibold solo pendientes. "Ver detalle ›" naranja 13px sin fondo en resto.

**Pie:** izq "Mostrando 1 a 8 de 60 órdenes" periwinkle 14px. Centro paginación ← 1 2 3 4 5 … 8 → (activa durazno + naranja semibold). Der selector "8 por página" borde gris + chevron.

**Diferencias vs versión anterior:** 4→3 cards (fuera Clientes únicos), pendientes sin sublabel, título tabla corto, columna SKU separada (fuera chip +N), "Producto/Cantidad" (antes Productos/Total unidades).

### Tareas
- [ ] Ruta `/ventas` en `AppRoutes.jsx` + item nav luego de Gestión Stock + capability `order.read` o `sales.read` (a definir con backend).
- [ ] `SalesPage`, `saleService.js` (o reutilizar `orderService`), mocks con datos arriba.
- [ ] Métricas, buscador (n° orden/cliente/producto/SKU), filtros (estado, fecha), paginación 8 por página.
- [ ] `Marcar despachado` → confirma y descuenta reserva → disponible; `Ver detalle` → modal como punto 7 adaptado a venta.
- [ ] Responsive tabla (scroll-x en mobile).

---

## 10. Inventario completo + ABM producto + ajuste manual stock

### Problema
Hoy la única forma de bajar stock es con despacho. Si se rompe mercadería en warehouse no hay forma de darla de baja.

### Requerimiento
Inventario de productos con todos los datos de stock + permitir modificación y baja de producto y su stock + ajuste manual (merma/rotura).

### Tareas
- [ ] Vista inventario: SKU, nombre, categoría, imagen, físico, reserva, disponible, mínimo, ubicación, necesita reposición.
- [ ] Editar producto (nombre, SKU, categoría, mínimo, objetivo, precio ARS, imagen).
- [ ] Baja producto (lógica, pide motivo, bloquea si tiene reserva/pendientes).
- [ ] Ajuste manual stock: `+ entrada / - merma / - rotura / - vencimiento / conteo` con motivo obligatorio + usuario + fecha. Afecta físico y recalcula disponible.
- [ ] Kardex / historial movimientos por producto.
- [ ] Permisos: solo `admin_warehouse`.

### Criterio de aceptación
Romper 5 unidades → ajuste -5 motivo "Rotura en picking" → físico y disponible bajan 5, queda auditoría.

---

## 11. Estados órdenes compra vs backend — mapeo sin cambiar backend

### Backend declarado — fuente: Backend §3.5 Estados de Orden (verdad)

| Estado | Descripción | Transiciones posibles |
|---|---|---|
| `pending` | La orden fue creada y está esperando asignación a un rover. | `in_progress`, `cancelled` |
| `in_progress` | Un rover fue asignado y está procesando la orden. | `completed`, `cancelled` |
| `completed` | La orden fue ejecutada exitosamente. | nil (estado final) |
| `cancelled` | La orden fue cancelada por el usuario o por el sistema. | nil (estado final) |

> Alcance: esto es `Order` = despacho al cliente. `RestockOrder` (`/restock/orders`) NO tiene `status` ni transiciones (RFC Restock §9: registro histórico simple). No confundir.

### Contrato API — fuente: Backend §9.4 Órdenes (verdad, antes citado como `3.7`)

Modelo `Order` (§3.3):

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único de la orden |
| `status` | enum | Estado actual. Ver §3.5 |
| `requested_by_user_id` | string (UUID) | Usuario que creó la orden |
| `items` | array\<OrderItem\> | Productos solicitados. Ver §3.3.1 |
| `destination_area` | string | Área destino dentro del warehouse |
| `assigned_vehicle_id` | string (UUID) \| null | Vehículo asignado. Null si aún no fue asignada |
| `timestamps.created_at` | string (ISO 8601) | Momento de creación |
| `timestamps.started_at` | string (ISO 8601) \| null | Momento en que un vehículo tomó la orden |
| `timestamps.completed_at` | string (ISO 8601) \| null | Momento de finalización |
| `cancel_reason` | string \| null | Motivo de cancelación, si aplica |

`OrderItem` (§3.3.1): `product_id` string (UUID), `sku` string (SKU al momento de la orden), `quantity` integer.

| Endpoint | Descripción | Rol requerido |
|---|---|---|
| `GET /orders` | Listado filtrado por rol. Params: `status`, `from`, `to`, `vehicleId`. | Todos los roles |
| `GET /orders/:id` | Detalle completo de una orden. | Todos los roles |
| `POST /orders` | Crea una nueva orden. Valida stock y publica en Redpanda. Request: `{ items: [{ product_id, quantity }], destination_area }`. Responde 201 con `order` en `pending`, `assigned_vehicle_id: null`, `timestamps: { created_at, started_at: null, completed_at: null }`. | `admin_sales`, `admin_warehouse` |
| `POST /orders/:id/cancel` | Cancela una orden `pending` o `in_progress`. Body: `{ reason }`. Devuelve Order con `cancelled`. | `admin_warehouse`, `admin_sales` |

Errores `POST /orders`:

| HTTP | Código | Descripción |
|---|---|---|
| 400 | `INSUFFICIENT_STOCK` | No hay stock suficiente para uno o más productos. |
| 400 | `PRODUCT_NOT_FOUND` | Uno o más `product_id` no existen. |
| 400 | `QUANTITY_EXCEEDS_LIMIT` | La cantidad supera el máximo permitido por orden. |
| 503 | `NO_VEHICLES_AVAILABLE` | No hay rovers disponibles en este momento. |

### DECISIÓN CONFIRMADA: sin cambio backend
`falla` NO es estado backend nuevo. Es **visual derivado de `cancelled + cancel_reason`**.
`completed` y `cancelled` son finales (nil): sin transiciones de salida.

### Mapeo UI
| UI negocio | Backend | Badge | Detalle |
| Solicitada | `pending` | Naranja Pendiente | Esperando rover, `assigned_vehicle=null` |
| En proceso | `in_progress` | Azul En proceso | Rover `VHC-xxx` asignado, `started_at` set |
| Despachado | `completed` | Celeste Despachado | `completed_at` = fecha despacho |
| Falla: falta stock | `cancelled` + reason `INSUFFICIENT_STOCK` | Rojo Falla - stock | Mensaje stock |
| Falla: robot | `cancelled` + reason `NO_VEHICLES_AVAILABLE` o falla rover | Rojo Falla - robot | Mensaje robot |
| Falla: otro / Cancelada | `cancelled` + otro reason | Rojo Cancelada | Muestra motivo |
- `timestamps.created_at` → Fecha compra, `completed_at` → Fecha despacho, `-` si null.
- `cancel_reason` siempre visible en detalle si `cancelled`.

### Tareas
- [ ] Util `mapOrderStatus(order)` centralizada.
- [ ] Filtros UI por estado negocio (mapean a 1 o N estados backend).
- [ ] Modal detalle venta muestra rover (`assigned_vehicle_id`), `destination_area`, timeline `creada→iniciada→completada/cancelada`, motivo falla.
- [ ] No pedir endpoint nuevo.

---

## 12. Cantidad sugerida de restock en front (PR #39 no mergeado — pendiente)

> Origen: PR #39 "Calcula la cantidad sugerida de restock en el front". No se mergeó, queda como tarea.

### Contexto
El cálculo vivía en `POST /metrics/restock-suggestions` (rama `feature/metrics-endpoints`). Backend confirmó que no la va a mergear, ese endpoint no va a existir: la columna "Sugerencia" mostraba "Sin dato" y el operador ponía la cantidad a mano siempre.

### Requerimiento (tal cual el PR)
Calcular la sugerencia localmente con política de reposición por nivel: reponer hasta el doble del stock mínimo, descontando lo ya pedido a proveedores y sin pasarse del máximo por orden del producto. Todo lo que entra al cálculo es dato real del backend (`GET /products` + órdenes abiertas que la pantalla ya tenía cargadas); lo único propio es el multiplicador, con nombre en `LOCAL_RESTOCK_POLICY`.

### Reglas
- NO es proyección de demanda y no se presenta como tal: no reproducible porque la Query API marca `items.quantity` e `items.product_id` como `selectable:false`, sin serie de consumo.
- Cada fila lleva `suggestionSource` y la UI aclara de dónde salió el número.
- NO cambia la condición de alerta: sigue siendo stock disponible < mínimo (igual que `StockDrainService`). El stock en tránsito solo afecta la cantidad, nunca esconde un faltante.
- Si el backend algún día expone la métrica, gana: `listAlerts` la consulta primero y este cálculo queda de fallback.
- Modal deja editar la cantidad sugerida cuando es local (la del backend se confirma tal cual).
- Mostrar "Ya pedido" en modal y "(+N en camino)" en tabla.
- Sacar el aviso permanente de "el backend todavía no calcula esto" y su CSS.

### Tareas
- [ ] Rescatar/rehacer cálculo local (`src/lib/restockSuggestion.js`, `LOCAL_RESTOCK_POLICY`).
- [ ] `suggestionSource` por fila + aclaración UI del origen.
- [ ] Columna "Ya pedido" / "(+N en camino)".
- [ ] Cantidad editable si es local.
- [ ] `listAlerts`: primero backend, fallback local.
- [ ] Eliminar aviso permanente + CSS.

---

## Orden de implementación sugerido
1. BaseModal (6) → desbloquea 7, 8.
2. Logo (1) + anchos (2) + ARS fijo (3) — quick wins.
3. Cancel restock (4) + modal acciones (7) + imagen nueva orden (8).
4. Stock datos (5) + inventario/ajuste (10).
5. Ventas (9) + mapeo estados (11).
