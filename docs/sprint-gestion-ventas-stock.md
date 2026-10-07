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
- [x] Auditar dónde se usa el logo: `grep -r "logo" src/ public/ index.html vite.config.js nginx.conf Dockerfile`.
  - Resultado 2026-10-07: causa raíz en `src/components/ui/Logo/Logo.jsx:6` — `src="src\assets\logos\Logo_(sin fondo).png"` (backslashes estilo Windows, string sin procesar por Vite, archivo nunca emitido al `dist`). Las hipótesis 1-5 del doc quedaron descartadas salvo el mecanismo: `vite.config.js` ya tenía `base: '/app/'` y `AppRoutes.jsx:20` ya usaba `basename`.
- [x] Estandarizar: importar con `import logo from '@/assets/logo...'` o usar `${import.meta.env.BASE_URL}logo.png`.
  - Hecho 2026-10-07: `import logoUrl from "../../../assets/logos/Logo_(sin fondo).png"` (mismo patrón que `AuthIlustration.jsx:3`). Vite emite `dist/assets/Logo_(sin fondo)-<hash>.png` y el bundle referencia `/app/assets/...` automáticamente.
- [x] Verificar `vite.config.js`: `base: '/app/'` para prod.
  - Ya estaba correcto, sin cambios.
- [x] Verificar `BrowserRouter basename={import.meta.env.BASE_URL}` ya existe en `src/routes/AppRoutes.jsx` — replicar criterio para assets.
  - Ya existía; el import de Vite replica el criterio (respeta `base` en build, `/` en dev).
- [x] Probar `npm run build && npm run preview` local con base `/app/`.
  - Hecho 2026-10-07: build OK, `vite preview` responde 200 en `/app/`, `/app/Logo.png` (favicon) y `/app/assets/Logo_(sin fondo)-<hash>.png`.
- [ ] Verificar en servidor: abrir DevTools → Network → ver 404 del logo, confirmar path pedido.
  - Pendiente: solo verificable con acceso al servidor Warehouse-USAL.
- [ ] Recargar imagen del logo en alta resolución (SVG preferido, fallback PNG 2x).
  - Pendiente: no existe SVG en `src/assets/logos/`; requiere asset de diseño de negocio. El PNG actual pesa ~538 KB — candidato a optimizar cuando llegue el SVG.

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
- [x] Inspeccionar `src/pages/StockManagement/StockManagementPage` + estilos.
  - Resultado 2026-10-07: el desparejo era intencional en `StockManagementPage.css:174` → `minmax(0, 0.92fr) minmax(0, 1.28fr)` (panel derecho ~40% más ancho).
- [x] Unificar contenedor: mismo `max-width`, `padding`, `border: 1px solid #E5E7EB`, `border-radius: 12-16px`.
  - Hecho 2026-10-07: `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)` (una línea). Los paneles ya comparten `Card` + `.stock-panel` (mismo padding/borde/radio), solo difería el ancho de columna. Se conservó `minmax(0, …)` para que las tablas anchas scrolleen dentro del panel sin estirar la grilla. Build OK.
- [ ] Verificar en 1600px, 1366px, 768px, 375px.
  - Parcial: 1600/1366 usan el grid igualado; 768/375 caen bajo el breakpoint `1180px → 1fr` (apilados iguales, sin cambios). Pendiente captura visual lado a lado pixel-perfect.

### Criterio de aceptación
Captura lado a lado: ambas tarjetas alineadas pixel-perfect.

### Ajuste UI según spec de negocio (2026-10-07)
Spec detallado provisto por negocio (mockup con datos mayo 2024). Se tomó como guía estructural; tamaños y colores no se tocaron.

Hecho en `StockManagementPage.jsx` (+ CSS huérfano eliminado):
- Columna `SKU` separada en ambas tablas (antes apilado bajo el nombre). Alertas: Producto · SKU · Stock actual · Stock mínimo · Sugerencia de reestock · Acciones. Órdenes: Orden · Fecha · Producto · SKU · Solicitado · Recibido · Unidad · Estado · Acciones.
- Header `Sugerencia` → `Sugerencia de reestock`.
- Acción en órdenes: pendientes muestran `Ver acción`, el resto `Ver detalle` (abre el mismo modal detalle hasta que exista el modal de acciones del punto 7).

No tocado a propósito:
- Nav `Asignación de stock`: el spec dice "Asignación de Ubicación", pero el nombre actual se usa en 6 lugares consistentes (`Navbar`, `HomePage`, `ProductsPage`, `CreateProductForm`, mocks, permisos). Renombrar solo el nav rompería esa consistencia; va a decisión de negocio.
- Copy: el código ya está todo en voseo (`Gestioná…` también en el panel derecho); el tuteo del mockup (`Gestiona`) era inconsistencia del ejemplo, no del código.
- Regla de estados `deriveStatus` sin cambios: parcial → `recibido`, completo → `completado`.
- Datos del mockup (mayo 2024): `RST-00020` figura "Completado" con 36/40 y `RST-00022` "Recibido" con 20/20 — ambos contradicen la regla vigente; son datos de ejemplo. Si negocio quiere admitir cierre con faltante o un paso intermedio manual, se define como regla nueva (punto 4/11).

### Refinamiento visual de paneles (2026-10-07, pedido directo de negocio)
- (a) Eliminado el cuadro amarillo "El cálculo de cantidad sugerida todavía no está disponible…" del panel de alertas (JSX + CSS huérfano). La columna Sugerencia sigue mostrando `—` con tooltip cuando el backend no la calcula.
- (b) Descripción de ambos paneles igualada al subtítulo de página: `14px` + `var(--color-text-secondary)` (antes `13px` azul). Nota: se usó `text-secondary` que es el token real del subtítulo (`PageHeader.css:16-20`), no `text-secondary-alt`.
- (c) Contador `(N)` de ambos títulos en bold y color del título (`color: inherit` + `var(--weight-bold)`).
- (d) Headers de ambas tablas: `var(--color-text-secondary)` + `var(--weight-bold)` (misma clase `.stock-table`, aplica a las dos).
- (d2) Tablas con borde propio igual a la Card madre: `1px solid var(--color-border-soft)` + `var(--radius-md)` sobre `.stock-table-wrap`.
- (e) Altura de filas `72px` → `60px` en ambas tablas (misma clase, siguen alineadas entre paneles).
- (f) Tabla de órdenes: celda de producto con solo foto (se quitó el nombre; el SKU ya tiene columna propia y el nombre sigue en filtros + modal detalle).

### Segunda ronda de refinamiento (2026-10-07, pedido directo de negocio)
- (1) Respiro entre tabla y card madre: `.stock-table-wrap` con `margin: 0 var(--space-3) var(--space-3)` (y `width: auto` para no desbordar con el margen).
- (2) Altura de filas: ya era la misma en ambas tablas (una sola regla `tbody tr 60px`) — sin cambios.
- (3) Botón `Orden de Restock` más chico (padding `6px 10px`, `12px`, solo en tabla de alertas) y con variante existente `warning-outline`: borde + texto + icono en `var(--color-yellow-primary)` (antes `secondary` gris). Sin variante nueva.
- (4) `Ver acción` / `Ver detalle` en amarillo `var(--color-yellow-primary)` (hover `yellow-dark`). Se mantiene el icono chevron (renderiza `>`) en vez de caracter literal.
- (5) Placeholder del buscador de alertas → `Buscar por producto o SKU`.
- (6) `max-width: 88px` de headers numéricos pasado a variable `--stock-table-head-max` (definida en `.stock-management`, mismo valor en todas las pantallas). Aclaración: el scroll lo causaba el ancho del contenido, no ese tope — se achicó el contenido (botón, padding de celdas `space-3` → `space-2`, nombre `110px` → `96px`) para que entre sin scroll en desktop. En mobile el scroll-x sigue como fallback.

### Tercera ronda (2026-10-07, pedido directo de negocio)
- Contenedor global `--container-width: 1440px` → `1700px` (`variables.css`). Era el tope real que recortaba las cards: a 1600px de viewport cada panel pasa de ~670px a ~750px y la columna Acciones entra sin scroll. Afecta a todas las páginas (mismo token). En viewports ≤1366 el límite sigue siendo el viewport.
- Botón `Orden de Restock` más bajo: `height: 32px` (el `height: 55px` fijo de `.button` ignoraba el padding; por eso el ajuste anterior no había cambiado la altura).
- `Ver acción` / `Ver detalle` con `>` literal (`&gt;`) en vez del icono chevron SVG.

### Cuarta ronda (2026-10-07, pedido directo de negocio)
- Tabla derecha sin scroll horizontal: modificador `stock-table-wrap--fit` (`overflow: hidden`) solo en órdenes; la de alertas conserva el scroll como fallback.
- Para que entre a presión se compactó solo esa tabla: celdas con padding lateral `space-2`, headers con wrap permitido, thumb `34px` → `28px`, badge `13px` → `12px`, link de acción `14px` → `13px`.
- Red de seguridad: debajo de 1500px de viewport el panel ya no contiene las 9 columnas y vuelve `overflow-x: auto` (si no, se recortaría la columna Acciones justo la que se quería mostrar). En mobile (<1180px) los paneles ya apilan a ancho completo.

### Quinta ronda (2026-10-07, pedido directo de negocio)
- Títulos (`thead th`) y contenido (`tbody td`) de ambas tablas centrados (`text-align: center`), incluida la celda de producto (`justify-content: center`) y la columna de acciones.

---

## 3. Alta — ARS fijo sin posibilidad de cambio

### Requerimiento confirmado
Mantener ARS como aparece ahora pero **sin permitir cambiarlo**. No es selector, es valor fijo.

### Alcance
Aplica al alta de producto y a la creación de orden de restock / remito (todo lo que hoy muestre moneda).

### Tareas
- [x] Reemplazar `<select moneda>` por texto fijo `ARS` o select `disabled` con único option `ARS`.
  - Hecho 2026-10-07: en la práctica era un `<input>` editable, no un select (`CreateProductForm.jsx`). Reemplazado por badge fijo `ARS` (se reutilizó la clase `.cpf-currency`, que existía huérfana). En restock/remito no hay ningún campo de moneda en UI.
- [x] Hardcodear `currency: 'ARS'` en payload (`productService.js`, `restockService.js`).
  - Hecho: `toPricePayload` en `productService.js` manda siempre `"ARS"`. En `restockService.js` no hay moneda en ningún payload (órdenes y remitos no la usan).
- [x] Validación frontend: si llega otra moneda, bloquear submit.
  - Hecho: `validate(values, initial?.price?.currency)` bloquea la edición de un producto legacy con otra moneda (error bajo el badge). En alta no hay forma de ingresar otra.
- [x] Quitar opciones USD / otras del UI y de mocks (`src/services/mocks/`).
  - Verificado: no existe `USD` ni otra moneda en `src/`; todos los mocks ya eran `ARS`.

### Criterio de aceptación
No existe forma por UI de cargar otra moneda que no sea ARS. ✅ (verificado: sin input de moneda, payload fijo, mocks ARS)

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
- [x] Botón `Cancelar orden` outline rojo + icono tacho (coherente con alerta).
  - Hecho 2026-10-07 (front): en el footer del modal detalle, solo para órdenes `pendiente` (`variant="danger-outline"` + icono `trash` existente). De paso se achicó el ancho de los botones del footer (el `width: 100%` base los estiraba).
- [x] Modal confirm: motivo obligatorio (select: `Ya no es necesaria / Stock incorrecto / Duplicada / Otro` + textarea).
  - Hecho (front): segundo modal con `Select` + textarea (detalle obligatorio solo si motivo = `Otro`, opcional en el resto). Doble paso como pide el flujo.
- [x] Integrar `restockService.cancelOrder(id, reason)` / `orderService`.
  - Hecho (front): `restockService.cancelOrder` apunta al contrato esperado `POST /restock/orders/:id/cancel { reason }`. Sin rama de mock (no hay contrato que mockear todavía).
- [x] Manejar errores: ya `in_progress` con rover asignado, sin permiso `admin_warehouse/admin_sales`.
  - Parcial (front): errores se muestran en el modal vía `errorText` con fallback propio ("El backend todavía no soporta la cancelación…"). Sin gating de permisos en front (el backend autoriza); `Order`/rover aplica a ventas (punto 9), no a restock.
- [x] Refrescar lista + métricas.
  - Hecho (front): al confirmar OK cierra ambos modales, muestra feedback y recarga (`load()`).

### Criterio de aceptación
Orden pendiente se puede cancelar con motivo, cambia a cancelada y queda trazabilidad.
- 🟡 Front completo y verificado (lint + build). **Bloqueado por backend**: sin `status` en `RestockOrder` no hay badge `cancelled` posible y sin endpoint el POST responde 404. Para cerrar el punto falta en backend: campo `status` + transición a `cancelled` + `POST /restock/orders/:id/cancel` (o definición de negocio si la cancelación va por otro flujo).

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
- [x] Crear `src/components/ui/BaseModal/BaseModal.jsx + .css`.
  - Resuelto 2026-10-07 sin archivo nuevo: se extendió el `Modal` existente con prop `subtitle` (decisión: no duplicar componentes). El overlay gris 50% y el subtítulo gris (`text-secondary`) se mantienen por decisión de negocio del 2026-10-07, contra el spec original (overlay azulado con blur, subtítulo azul).
- [x] Crear subcomponentes: `ProductCard`, `InfoGrid`, `AlertBanner`, `ModalFooter`.
  - Parcial: `ProductSummaryCard` (`src/components/stock/ProductSummaryCard/`) compartida por 4 modales (acciones restock, nueva orden, 2 de asignación). `InfoGrid`/banner quedaron como estilos locales del modal de acciones (solo él los usa); footer ya era patrón (secundario + primario/destructivo a derecha) en todos.
- [x] Migrar: Acciones restock, Nueva orden restock, Agregar remito, Ver detalle venta.
  - Parcial 2026-10-07: migrados acciones restock, nueva orden, `ProductLocationModal` y `LocationAssignmentModal` (card + `subtitle`; el resto de cada modal intacto). Pendientes: `RemitoModal`, `LocateReceptionModal`, resto (warehouse/usuarios, ver `docs/futuro-unificacion-modales-css.md`).
- [ ] Storybook/manual de uso en este doc.
  - Pendiente. Uso actual: `Modal` + `subtitle` + `ProductSummaryCard { imageUrl, name, sku, category?, metrics[]?, badge? }`.

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
- [x] Implementar con `BaseModal` + datos reales (`orderId`, `product`, `timestamps`).
  - Hecho 2026-10-07 según spec literal de negocio: `Modal` extendido con `subtitle` + `ProductSummaryCard` compartida (thumb/imagen, nombre, SKU azul, categoría, métricas actual/mínimo/sugerida) + grilla `Información de la orden` 2×3 + banner rosa solo si no hay remito + footer derecha. Tamaño `md`.
- [x] Estado `Pendiente` naranja con dot; si `cancelled` pasar a rojo (punto 9).
  - Hecho: estado sin pill (punto + texto, `.order-status--pendiente/recibido/completado`). `cancelled` queda para cuando el backend tenga el estado (punto 4).
- [x] `Observaciones: -` cuando vacío.
  - Hecho: backend no tiene el campo → siempre `—` (igual que fecha estimada, que tampoco existe en `RestockOrder`). Sin inventar datos.
- [x] Conectar `Cancelar orden` con punto 4.
  - Hecho: abre el modal de confirmación con motivo del punto 4.

Desvíos honestos del spec: la lista `Remitos de esta orden` se conserva cuando hay recepciones (el spec solo mostraba el caso sin remito); proveedor no se muestra (el spec no lo incluye en la grilla); iconos de métricas reutilizados del set existente (`box/alert/chart`, no existen manos/flechas en `Icon.jsx`); overlay gris 50% ya existente (coincide con el spec, no se tocó).

### Sexta ronda (2026-10-07, pedido directo de negocio)
- Estados siempre con fondo: el modal de acciones usa el mismo `Badge` con pill que la tabla (se eliminó el estilo dot-only sin fondo).
- SKU de la card, subtítulo del modal e icono de categoría en `var(--color-text-secondary)` (color de "Gestioná tus órdenes…"), no azul. Aplica a ambos modales por ser componentes compartidos.

### Séptima ronda (2026-10-07, pedido directo de negocio)
- (1) Nueva orden: la card aparece debajo del selector de producto (orden: selector → card → cantidad).
- (2) Remito: al elegir orden muestra la misma `ProductSummaryCard` (imagen, categoría, actual/mínimo). `ProductSummaryCard` ya en 5 modales.
- (3) Subtitle del remito movido al header del `Modal` (arriba de la línea), como el resto.
- (4) Métricas de la card con `align-items: center` (el icono desplazaba la línea de base y el valor quedaba un escalón abajo).
- (5) Categoría larga en una línea con ellipsis + tooltip del texto completo.

---

## 8. Modal nueva orden restock — incluir imagen al seleccionar producto

### Requerimiento
Cuando se selecciona producto, mostrar imagen como en modal agregar remitos de recepción.

### Tareas
- [x] Reutilizar `ProductCard` / thumb 48-64px + nombre + SKU + stock actual/mínimo.
  - Hecho 2026-10-07 por unificación con el modal de acciones: `Nueva orden` usa la misma `ProductSummaryCard` (thumb 84px con imagen o placeholder caja, nombre, SKU, categoría, métricas actual/mínimo/sugerida). Aplica tanto desde alerta como al elegir producto en modo libre.
- [x] Si producto sin imagen, placeholder con icono caja gris.
  - Hecho: la card lo trae (patrón existente: la imagen tapa al icono solo si carga).
- [ ] Preview actualiza cantidad sugerida automáticamente.
  - Pendiente: la card muestra la sugerida del backend cuando existe; edición de cantidad según punto 12 (congelado).

### Unificación (2026-10-07, pedido directo de negocio)
Ambos modales comparten base (`Modal` + `subtitle` azul), card y patrón de footer (secundario + primario/destructivo a derecha); solo cambia la info. Subtitles cortos nuevos en `Nueva orden` (el texto largo pasó al cuerpo como `note`). Se eliminó la grilla de stats duplicada y su CSS huérfano.

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
- [x] Ruta `/ventas` en `AppRoutes.jsx` + item nav luego de Gestión Stock + capability `order.read` o `sales.read` (a definir con backend).
  - Hecho 2026-10-07: ruta `/ventas` + item "Gestión de ventas" + `order.read` (todos los roles, espejo del backend §9.4) y `order.cancel` (SUPERADMIN/ADMIN_WAREHOUSE/ADMIN_SALES).
- [x] `SalesPage`, `saleService.js` (o reutilizar `orderService`), mocks con datos arriba.
  - Hecho: `orderService.js` (list/get/cancel + `mapOrderStatus` del §11 + códigos `OC-xxxxx`) + `orderMockService` (12 órdenes, test node OK). Se llamó `orderService` (no `saleService`): es el `Order` del backend.
- [x] Métricas, buscador (n° orden/cliente/producto/SKU), filtros (estado, fecha), paginación 8 por página.
  - Hecho: 3 cards (pendientes, despachadas 30d, total 30d), buscador full, filtros estado (con Falla agrupada) + fecha, 8 por página con selector. Cancelada en ROJO.
- [x] `Marcar despachado` → confirma y descuenta reserva → disponible; `Ver detalle` → modal como punto 7 adaptado a venta.
  - Parcial: `Ver detalle` hecho (rover, destino, timeline creada/iniciada/cerrada, motivo, productos, cancelar real con motivo). **Despacho manual bloqueado**: el backend no tiene endpoint (la orden la completa el rover vía Central); el botón abre la confirmación y ahí se informa. Sin inventar llamadas.
- [x] Responsive tabla (scroll-x en mobile).
  - Hecho: `overflow-x` en wrapper + apilado de métricas y grilla en mobile.

Desvíos/gaps backend anotados: (1) `Order` no trae cliente — columna best-effort vía `userService` (requiere `admin_system`, si no "—"); (2) multi-item muestra primero + "+N"; (3) `En proceso` en gris neutro (el celeste quedó para Despachado según spec); (4) forma de `GET /orders` asumida como `{ orders, pagination }` (patrón restock) — confirmar contra backend real.

---

## 10. Inventario completo + ABM producto + ajuste manual stock

### Problema
Hoy la única forma de bajar stock es con despacho. Si se rompe mercadería en warehouse no hay forma de darla de baja.

### Requerimiento
Inventario de productos con todos los datos de stock + permitir modificación y baja de producto y su stock + ajuste manual (merma/rotura).

### Tareas
- [x] Vista inventario: SKU, nombre, categoría, imagen, precio, físico, reserva, disponible, mínimo, ubicación, necesita reposición. Tabla formato Ventas (sin scroll horizontal: filas apiladas bajo 768px, columna dimensiones descartada por negocio).
- [x] Editar producto (nombre, SKU, categoría, mínimo, objetivo, precio ARS, imagen) — modal existente, ahora desde la acción por fila.
- [x] Baja producto (lógica) en DOS pasos (aviso → confirmación final), sin motivo.
- [x] Ajuste manual stock: `+ entrada / - merma / - rotura / - vencimiento / conteo` → `PATCH /warehouse/positions/:id { current_stock }` (verificado 2026-10-07 contra backend local: recalcula físico/reserva/disponible del producto).
- [ ] Ajuste con motivo obligatorio + usuario + fecha (auditoría): ⛔ backend — `UpdatePositionRequest` no tiene campo de motivo ni historial; no se pide en el front para no simular una auditoría que no se persiste.
- [ ] Kardex / historial movimientos por producto: ⛔ backend — no existe endpoint de movimientos.
- [x] Permisos: ajuste = `stock.assign`; editar/borrar = `product.edit`/`product.delete` (espejo del backend).

### Criterio de aceptación
Romper 5 unidades → ajuste -5 → físico y disponible bajan 5. ✔ verificado en backend local (PATCH posición → `GET /products` devuelve physical/available recalculados; 20 → 15 → available 9, restaurado a 20). La auditoría (motivo/usuario/fecha) queda bloqueada por backend.

### Implementación (2026-10-07)
- Tabla en `ProductsPage.jsx` (clases `products-table*`, CSS propia en `ProductsPage.css`, mismo patrón que `sales-table`/`stock-table`). Acciones por fila: editar / ajustar / eliminar.
- Ajuste: modal con posición (viene de `getLocations()`, con `current_stock` por posición), tipo, cantidad y preview actual → resultante. Es un valor absoluto por posición; el front calcula el delta. Validación front: entero ≥ 0 y no bajar de la reserva (el backend permite stock físico < reserva y dejaría disponible negativo); capacidad/mínimo los valida el backend con 400.
- Producto sin posiciones: no muestra la acción de ajuste (la carga inicial es Asignación de stock).
- Se eliminó `ProductCard` (quedó sin uso) y los alias snake_case de `normalizeLocation` (solo los usaba esa card).

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

## 12. Cantidad sugerida de restock (RESUELTO por backend — RFC Métricas)

> Actualización 2026-10-07: el backend SÍ tiene la métrica (RFC Métricas + Swagger verificado: `POST /metrics/restock-suggestions`, `/apply`, `/metrics/catalog` con `computed_metrics`, campo `restock` en producto). El cálculo local del PR #39 no se rescata: la fórmula por demanda del backend lo reemplaza.

### Conexión en el front (2026-10-07)
Cadena en `listAlerts`: `product.restock` guardado (corrida diaria, sin request) → `POST` en vivo → `null` (aviso + cantidad a mano). `normalize` lee `restock`; `fromStoredRestock` arma la fila (umbral = punto de reposición, en pedido = posición − disponible); cada fila lleva `source` (`stored`/`backend`/`local`). Lint + build + test node OK.

### Tareas originales (estado)
- [x] `listAlerts`: primero backend, fallback local.
- [x] `suggestionSource` por fila (`source` en cada row).
- [ ] Columna "Ya pedido" / "(+N en camino)" — pendiente, dato disponible (`onOrderStock`).
- [ ] Cantidad editable si es local — no aplica (no hay cálculo local).
- [ ] Eliminar aviso permanente + CSS — el aviso ya se había quitado; el actual solo sale sin ninguna fuente.

### Diagnóstico 2026-10-07 — tabla de alertas vacía con productos bajo mínimo (solo documentado, sin cambio de código)
Caso: DES-001 (disponible 1, mínimo 10) no aparece; la tabla queda vacía aunque MOU-010 (0 < 14) y TAL-001 (14 < 20) también están bajo mínimo.
Causa verificada contra el backend local: el `POST /metrics/restock-suggestions` (mismos params del front) devuelve `should_restock: false` en los 3 (DES-001: posición 1 vs punto 0.0; MOU-010: posición 150 vs punto 0.0; TAL-001: posición 174 vs punto 1.29). El backend compara posición de inventario (disponible + en tránsito) contra punto por demanda, y sin historial de ventas el punto da ~0. Como el vivo devuelve `[]` (no `null`), el fallback local de `listAlerts` nunca corre (`suggested ?? buildRestockAlerts(...)` en `StockManagementPage.jsx:177`) y la tabla queda vacía.
Aplica a cualquier ambiente con productos sin demanda: local y servidor se comportan igual (mismo front, depende solo de los datos de cada backend).
Fix propuesto (no aplicado): en `listAlerts`, sumar las alertas locales (`needsRestock`) de los productos que el backend no marcó, con sugerencia `null`. Trade-off: mezcla criterio por demanda con criterio por mínimo (un producto con mercadería en camino aparecería igual). Decisión pendiente de negocio.

---

## Orden de implementación sugerido
1. BaseModal (6) → desbloquea 7, 8.
2. Logo (1) + anchos (2) + ARS fijo (3) — quick wins.
3. Cancel restock (4) + modal acciones (7) + imagen nueva orden (8).
4. Stock datos (5) + inventario/ajuste (10).
5. Ventas (9) + mapeo estados (11).

---

## Anexo — Estado por punto (actualizado 2026-10-07)

> Se actualiza a medida que se completa cada punto. Convención: ✅ completado (verificado en front) · 🟡 parcial / pendiente de servidor o backend · ⬜ no iniciado · ⛔ bloqueado por backend · 🔒 congelado por decisión.

| # | Punto | Estado | Qué falta |
|---|---|---|---|
| 1 | Logo no carga en servidor | ✅ front verificado | Verificación en servidor (Network) + SVG alta resolución de negocio |
| 2 | Gestión de Stock — igualar anchos + ajuste UI spec negocio | ✅ front verificado | Captura visual lado a lado pixel-perfect (1600/1366/768/375px). Decisiones abiertas: nombre "Asignación de Ubicación" y semántica de cierre parcial |
| 3 | Alta — ARS fijo | ✅ completado | — |
| 4 | Cancelar orden de restock | 🟡 front listo, ⛔ backend pendiente | Backend: campo `status` + endpoint cancel en `RestockOrder` (ver criterio punto 4) |
| 5 | Datos de stock en ficha | ⬜ no iniciado | UI: disponible / reserva / físico / badge Reponer (datos ya expuestos en `productService.normalize`) |
| 6 | BaseModal único | 🟡 parcial (patrón compartido, 4 modales) | Migrar RemitoModal, LocateReceptionModal, resto + manual de uso |
| 7 | Modal Acciones restock | ✅ completado (spec negocio) | Verificación visual en browser |
| 8 | Nueva orden restock con imagen | 🟡 parcial (card unificada) | Preview auto de sugerida (depende punto 12, congelado) |
| 9 | Gestión de Ventas | 🟡 front listo (despacho manual bloqueado) | Backend: endpoint despacho manual + cliente en Order + confirmar forma GET /orders |
| 10 | Inventario + ABM + ajuste manual | 🟡 front listo (tabla + baja en 2 pasos + ajuste vía PATCH posición) | Auditoría del ajuste (motivo/usuario/fecha) y kardex ⛔ backend. Verificación visual 1600/1366/768/375 |
| 11 | Mapeo estados órdenes | ⬜ no iniciado | Util `mapOrderStatus` + filtros + detalle. Conviene hacerlo junto con 9 |
| 12 | Sugerencia de restock | ✅ conectado (restock → POST → —) | Columna "Ya pedido" con onOrderStock (dato ya disponible) |
