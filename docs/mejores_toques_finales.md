# Mejoras — toques finales

> Rama: `feature/toques-finales` | Base: `develop`
> Registro breve de cada cambio o hallazgo del cierre del proyecto.

---

## 1. Login: se quita "¿Querés sumarte como proveedor?"

- Se eliminó el link del login, que apuntaba a `/register-provider`. No hay
  ruta para esa URL y `src/pages/auth/RegisterPage/` es una carpeta vacía; no se
  borró ninguna página.
- Se eliminó también su estilo huérfano (`a.registrar_proveedor`).
- Archivos: `src/pages/auth/LoginPage/LoginPage.jsx`,
  `src/components/auth/LoginForm/LoginForm.css`.

---

## 2. Login: se oculta "¿Olvidaste tu contraseña?" (no hay endpoints)

**Revisado contra:** swagger local (`http://localhost:8080/v3/api-docs`) y
`wh-backend` (`develop`, `cdc58de`, 2026-11-04).

**Endpoints de contraseña que existen:**

| Método | Ruta | Requiere | Uso |
| --- | --- | --- | --- |
| `POST` | `/users/{id}/reset-password` | JWT, rol `SUPERADMIN` o `ADMIN_SYSTEM` | Un admin le pone una contraseña nueva a otro usuario (ya se usa en Usuarios) |
| `POST` | `/users/me/change-password` | JWT | El usuario logueado cambia su propia contraseña |

**Lo que falta:**

- No hay ningún endpoint público (sin login) para pedir el enlace de
  recuperación ni para restablecer la contraseña con un token. En
  `SecurityConfig`, `/auth/login` es el único endpoint público de auth.
- El backend tampoco tiene envío de mails configurado.

**Cambio en el front:** el link "¿Olvidaste tu contraseña?" del login quedó
comentado, no borrado. La página `/forgot-password` (4 pasos, solo visual: no
llama al backend) sigue existiendo, pero ya no se llega desde la UI. Para
reactivarlo hay que descomentar el link y volver a importar `Link` en
`LoginPage.jsx`.

**Para implementarlo, el backend tendría que agregar:**

1. `POST /auth/forgot-password` `{ email }`: genera un token con vencimiento y
   envía el mail.
2. `POST /auth/reset-password` `{ token, new_password }`: valida el token y
   cambia la contraseña.
3. La configuración de mail (SMTP) y estos dos endpoints como públicos en
   `SecurityConfig`.

Mientras tanto, la alternativa es que un admin restablezca la contraseña desde
Usuarios.

---

## 3. Services: se eliminan los mocks y los flags `VITE_USE_MOCK`

- Se borraron `src/services/mocks/` (7 archivos), `src/services/pruebasMockUp.js`
  y `src/lib/localStore.js` (solo lo usaban los mocks).
- En los 11 services se quitaron el import del mock, la constante `USE_MOCK` y
  todas las ramas `if (USE_MOCK) ...`. Lo que hacen contra el backend no cambió.
- También se quitaron los helpers que solo usaban los mocks: `paginate`
  (`lib/pagination.js`) y `newestFirst` (`restockService.js`).
- **Login (seguridad):** si el backend no respondía, `authService` entraba con un
  usuario de prueba aunque `VITE_USE_MOCK` estuviera en `false`. Ahora se muestra
  "No se pudo conectar con el servidor. Intentá de nuevo más tarde." (código
  `NETWORK_ERROR`).
- Los errores no se atrapan en los services: suben a las páginas, que los
  muestran con `src/lib/apiError.js`.

---

## 4. Productos: paginación en el servidor, columna y filtros nuevos

**Problema:** la tabla pedía una sola página de 50 productos (solo activos, los
más viejos primero) y paginaba en el navegador sobre esos 50. Pasados 50, el
resto no aparecía nunca, y el filtro por zona solo buscaba dentro de ese bloque.

**Cómo quedó (sin cambios en el backend):**

- Cada página se pide al servidor con `POST /query/products` (filtros, `page`,
  `size`). Sin `sort`, el backend ordena por `createdAt` descendente: los
  productos nuevos aparecen primero.
- Ese endpoint devuelve solo campos básicos, así que el detalle (stock, Reponer)
  se pide con `GET /products/{id}?isActive=false` para las filas visibles, y la
  ubicación también. Costo por página: 1 + 2 × filas, igual con 20 o con
  100.000 productos.
- **Columna "Activo"** antes de Reponer: Sí/No con el mismo `Badge`, así las
  dos columnas de estado quedan juntas.
- **Filtros:** Activo (Todos / Sí / No; por defecto **Sí**), Ubicación (Todas /
  Sin ubicación / Zona X) y Categoría.
- **Buscador único "nombre o SKU":** un texto con forma de SKU (letras + guion,
  ej. `TEC-` o `TEC-001`) se busca por SKU; cualquier otro, por nombre. Sigue
  siendo una sola consulta paginada en el servidor.
- **Zona y Sin ubicación:** `GET /warehouse/positions` (1 request) da qué
  productos están en cada zona; se filtra con `id in` / `id nin`.
- El contador "productos sin ubicación" de la tarjeta "Asignar stock" ahora es
  exacto (activos sin posición), con `productService.count`.
- Nuevo token `--filter-min-width` y clase reutilizable
  `.table-panel__filters--auto` para paneles con una cantidad variable de filtros.

**Límites:**

- El endpoint combina los filtros con "Y" y no puede buscar en nombre y SKU a
  la vez; por eso el buscador decide el campo por la forma del texto. Un SKU
  sin el guion (ej. `001`) se busca como nombre.
- Ubicación solo para `SUPERADMIN` / `ADMIN_WAREHOUSE` (los roles con acceso a
  `GET /warehouse/positions`); para el resto el filtro no aparece.
- Una zona con más de 100 productos distintos, o más de ~700 productos con
  ubicación en "Sin ubicación", muestran un error explicando el límite.

---

## 5. Vehículos: paginación en el servidor

- `GET /vehicles` sin parámetros devolvía solo 10 vehículos: el resto no
  aparecía.
- Ahora la tabla pagina de a 10 con `POST /query/vehicles` (búsqueda por nombre
  y filtro de estado en el servidor, orden A→Z) y el detalle con
  `GET /vehicles/{id}`. Se agregó el paginador al pie.

---

## 6. Ventas: nombres de clientes completos

- Para mostrar el nombre del cliente se pedían 200 usuarios, pero el backend
  devuelve como máximo 50 por página: pasados 50 usuarios, algunos clientes se
  veían como "—".
- Ahora `userService.listAll()` recorre todas las páginas (`fetchAllPages`).

---

## 7. Errores de carga: aviso amigable en el lugar de los datos

- **Antes:** Gestión de stock y Ventas mostraban un banner rojo arriba ("No se
  pudo cargar… Revisá la conexión con el backend") y la tabla vacía, como si no
  hubiera datos. Productos, Vehículos, Usuarios y Asignación mostraban "Algo
  salió mal" con el texto técnico. Configuración del warehouse no avisaba nada.
- **Ahora:** nuevo componente reutilizable `LoadError` (`src/components/ui/LoadError/`)
  que se muestra **en el lugar de la tabla o el mapa** que no cargó: ícono de
  sin conexión, "No pudimos cargar la información", un texto amable y el botón
  **Reintentar**, que vuelve a pedir solo esa sección.
- Usado en: Productos (tabla e historial de ajustes), Gestión de stock (alertas y
  órdenes de restock), Ventas, Vehículos, Usuarios, Asignación de stock y
  Configuración del warehouse.
- Nuevo ícono `wifiOff` en `Icon.jsx` (trazo SVG, mismo set que el resto).
- Los errores de acciones (crear, cancelar, ajustar) siguen mostrándose como
  hasta ahora: este cambio es solo para la carga de datos.

---

## 8. Gestión de stock: texto de la tarjeta de recepción

- La tarjeta "Agregar remitos de recepción" pasa a llamarse **"Recibir
  mercadería con remito"**, que describe la acción del usuario.
- Archivo: `src/pages/StockManagement/StockManagementPage.jsx`.

---

## 9. Modificar posiciones: se quita la opción "Inactiva"

- **Problema:** en "Modificar posiciones" se podía marcar una posición como
  inactiva (ej. P03). Al salir y volver a entrar, la posición desaparecía.
- **Causa:** en el warehouse, `is_active=false` es el borrado lógico del backend:
  el mapa y los editores solo muestran posiciones activas, así que "Inactiva"
  equivalía a borrarla sin aviso.
- **Cambio:** se quitó la columna "Estado" del editor; ahora solo se edita el
  tamaño. Para quitar o agregar posiciones se usa "Líneas" (cantidad de
  posiciones por línea).
- Las posiciones que ya se desactivaron no se pierden: al aumentar la cantidad
  de posiciones de su línea desde "Líneas", se reactivan antes de crear nuevas.
- Archivos: `src/components/warehouse/PositionsEditModal/PositionsEditModal.jsx`
  y `.css`.

---

## 10. Productos: tabla más compacta (13 → 9 columnas)

- **Stock** = disponible como dato principal y "Físico X · Reservado Y" debajo
  (antes: tres columnas de stock).
- **Reponer** conserva el badge Sí/No y muestra el punto de reposición al pasar
  el mouse (antes: columna "Punto de reposición" aparte).
- **Imagen** más grande (44 px) y **Nombre** completo: ya no se corta con "…",
  puede ocupar más de una línea.
- Se quita la columna **Activo**: con el filtro en "Sí" por defecto mostraba
  "Sí" en todas las filas. En su lugar, un producto dado de baja lleva la
  etiqueta gris **"Inactivo"** al lado del nombre (el filtro Activo se mantiene).
- Imagen, SKU, Nombre, Categoría, Precio, Ubicación y Acciones quedan como
  columnas separadas.
- Verificado con capturas a 1600 px y 375 px (datos de prueba): sin cortes ni
  scroll horizontal.

---

## 11. Productos: generar orden de restock desde la tabla

- Nuevo botón (carrito) en **Acciones** que abre el mismo `RestockOrderModal`
  de Gestión de stock con el producto ya elegido.
- Si la corrida diaria calculó una cantidad sugerida (`product.restock`), se
  precarga y se puede editar; si no, el campo arranca vacío.
- Visible solo para `SUPERADMIN` / `ADMIN_WAREHOUSE` (nueva capacidad
  `restock.create`, espejo de `POST /restock/orders`) y solo en productos
  activos. Al crear la orden se muestra un aviso de éxito y se recarga la página.

---

## 12. Asignación de ubicación: paginación en las dos tablas

- "Productos sin ubicación asignada" y "Productos de restock pendientes de
  ubicación" tienen el mismo pie que Gestión de stock: "Mostrando X a Y de N
  productos" a la izquierda, las páginas en el medio y el selector de 5 / 10 /
  20 por página a la derecha.
- Cada tabla pagina por separado; la búsqueda vuelve a la página 1, y si se
  ubica el último producto de una página se muestra la anterior.
- Verificado con captura a 1600 px (datos de prueba).

---

## 13. Asignación de ubicación: carga paginada en el servidor

- **Antes:** traía todo el catálogo (`listAll`, hasta 1000 productos) y pedía la
  ubicación de cada producto, uno por uno, para saber cuáles no tenían.
- **Ahora, "Productos sin ubicación asignada":** `GET /warehouse/positions` (1
  request) dice qué productos tienen ubicación, y `POST /query/products` trae
  solo la página visible de los activos que no la tienen (`id nin`). Costo por
  página: 2 + filas visibles, sin importar el tamaño del catálogo. El contador
  del título sale del total del backend.
- **"Restock pendientes de ubicación":** se piden solo los productos de los
  remitos pendientes, no el catálogo entero.
- El buscador mantiene "nombre o SKU" con la misma regla que Productos (la
  función `searchFieldFor` pasó a `productService` para usarla en las dos
  pantallas).
- Cada tabla tiene su propio estado de carga y error (con Reintentar).

---

## 14. Categoría con su etiqueta ("Tecnología" en vez de "TECNOLOGIA")

- Nueva función `categoryLabel(value)` en `categoryService.js`: usa las
  etiquetas conocidas y, para una categoría nueva del backend sin etiqueta, la
  capitaliza.
- Se usa en la tabla de Asignación de ubicación y en la tarjeta de producto de
  los modales (Asignar ubicación y Generar orden de restock), que mostraban el
  valor crudo.

---

## 15. Productos: la orden de restock usa la misma sugerida que Gestión de stock

- **Antes:** el botón de restock de la tabla de Productos solo leía el
  `restock` guardado por la corrida diaria. Si todavía no había corrido, el
  modal decía "Sin dato" aunque Gestión de stock mostrara una sugerida (sacada
  de la simulación en vivo).
- **Ahora:** `restockService.alertFor(product)` sigue la misma cadena que
  `listAlerts`: guardado → `POST /metrics/restock-suggestions` filtrado a ese
  producto → sin cantidad. Si la simulación falla, el modal abre igual y la
  cantidad se escribe a mano.
- Revisado y sin cambios: un producto sin ventas no entra en las alertas del
  backend (`gap = 0`, el backend no mira el stock mínimo). Se deja así.

---

## 16. Ajuste manual: las reducciones descuentan sobre el stock real

- **Antes:** merma, rotura y vencimiento mandaban el stock final
  (`PATCH /warehouse/positions/{id}` con `current_stock`). Con la pantalla
  desactualizada, una merma podía pisar el cambio de otro usuario e incluso
  subir el stock.
- **Ahora:** se mandan como "restá N" a
  `POST /warehouse/positions/{id}/stock-adjustments` (`rotura` → `DAMAGE`,
  `merma` y `vencimiento` → `MANUAL_DECREASE`). El backend valida contra el
  stock real y, si no alcanza, responde `QUANTITY_EXCEEDS_POSITION_STOCK`, con
  un mensaje que pide reabrir el ajuste. Entrada y conteo siguen con `PATCH`.
- Revisado: ningún camino de la UI deja stock negativo (el ajuste, el remito y
  el asignador de posiciones validan las cantidades antes de enviarlas).

---

## 17. Productos: tarjeta de producto en Ajustar stock y en el historial

- Los modales "Ajustar stock" e "Historial de ajustes" muestran arriba la misma
  `ProductSummaryCard` que Asignar ubicación (imagen, nombre, SKU y categoría),
  en lugar del texto "nombre · SKU" y del nombre en el título.
- "Ajustar stock" pasa a tamaño `md` para que la tarjeta entre cómoda.

---

## 18. Ajustar stock: error de capacidad dentro del modal

- **Antes:** si una entrada superaba la capacidad de la posición, aparecía un
  `window.alert` con el texto crudo del backend ("Stock 10553 exceeds capacity
  563").
- **Ahora:** los errores al aplicar el ajuste se muestran en un `StatusBanner`
  de error debajo del stock resultante, y se limpian al cambiar posición, tipo
  o cantidad. Para `STOCK_EXCEEDS_CAPACITY` el texto dice cuántas unidades
  admite la posición y con cuánto quedaría.
- Una cantidad que supera el tope de `current_stock` en el backend (int de
  Java, 2.147.483.647) se frena antes de enviar, con error en el campo: si no,
  el backend responde `MALFORMED_REQUEST` ("El cuerpo de la solicitud no es
  JSON válido") sin llegar a validar la capacidad.

---

## 19. Productos: sin estado "Inactivo"

- La tabla de Productos pide siempre solo los activos (`active: true`); se
  quitó el filtro "Activo" y el badge "Inactivo" de la fila.
- El formulario de alta/edición ya no tiene el selector "Estado": el backend
  crea los productos activos y, sin `is_active` en el PATCH, la edición no lo
  toca. Dar de baja sigue siendo "Eliminar".

---

## 20. Configuración del warehouse: "Seleccionar ubicación"

- El título de la tarjeta lateral pasó de "Ubicación" a "Seleccionar
  ubicación".

---

## 21. Vehículos: sin columna "Acciones"

- El botón "Ver detalle" no tenía acción. `GET /vehicles/{id}` existe, pero
  solo agrega orden actual, última conexión y "en operación desde" a lo que ya
  muestra la fila, así que se quitó la columna (y su CSS).

---

## 22. Mi perfil (menú del avatar)

- Nuevo ítem "Mi perfil" en el menú del avatar, para cualquier rol. Abre
  `ProfileModal` con: nombre, email y rol (más el proveedor si es `PROVIDER`),
  edición de nombre y dirección, y cambio de contraseña.
- Se lee con `userService.getMe`: como no existe `GET /users/me` y
  `GET /users/{id}` es solo admin, usa `PATCH /users/me` con cuerpo vacío, que
  no cambia nada y devuelve el usuario completo. El `GET` quedó pedido en
  `docs/nuevos_requisitos.md`; cuando exista, cambia solo esa función.
- La dirección se manda solo si cambió (el backend la reemplaza entera). Al
  guardar el nombre se actualiza el usuario guardado (`updateStoredUser`) y la
  barra lo muestra al cerrar el modal.
- Errores de contraseña traducidos: `WRONG_CURRENT_PASSWORD` y `SAME_PASSWORD`.

---

## 23. Inicio: accesos directos según el rol

- **Antes:** las 6 tarjetas de Inicio se mostraban a todos los roles, aunque la
  ruta después los rechazara (un ADMIN_SALES veía "Usuarios" o "Vehículos").
- **Ahora:** cada tarjeta lleva la misma capacidad que exige su ruta en
  `AppRoutes` y su ítem del Navbar, y solo se muestran las que el rol puede
  abrir.

---

## 24. Productos: filtros detrás del botón "Filtros"

- Ubicación y Categoría ya no se ven siempre: aparecen al tocar "Filtros", como
  en Gestión de ventas (mismo `filtersOpen` / `onToggleFilters` de
  `TablePanel`). Cerrar el panel no borra los filtros elegidos.

---

## 25. Productos: vuelven las tres columnas de stock

- La columna única "Stock" (disponible arriba, "Físico X · Reservado Y" abajo)
  se vuelve a separar en **Stock físico**, **Stock reservado** y **Stock
  disponible**, como antes de la entrada 10. El punto de reposición sigue en el
  tooltip de "Reponer". Se quitó el CSS de la columna agrupada.
- En mobile el número y "unidades" van juntos en un `<span>`: la celda es flex
  con `space-between` y, sueltos, quedaban separados.
- Verificado con capturas a 1600 px y 375 px (seed de demo, rol
  ADMIN_WAREHOUSE): las 11 columnas entran sin scroll horizontal.

---

## 26. Gestión de stock: categorías capitalizadas en el filtro de alertas

- El filtro "Categoría" de "Productos con alerta de reestock" mostraba el valor
  crudo del backend ("TECNOLOGIA"). Ahora usa `categoryLabel`, igual que la
  tabla de Productos ("Tecnología").

---

## 27. Gestión de ventas: órdenes con varios productos desplegables

- Una orden puede tener varios productos (en la seed, 38 de las últimas 50
  tienen 2 o 3) y la fila mostraba solo el primero, con el SKU de ese producto
  pero la cantidad de toda la orden.
- **Ahora:** las órdenes con varios productos tienen una flecha que despliega
  debajo un renglón por producto (imagen, nombre, SKU y cantidad). En la fila
  de la orden, el SKU dice "Varios" y la cantidad es el total. Las de un solo
  producto quedan como antes.
- "1 unidad" en singular (antes decía "1 unidades").
- Verificado con captura a 1600 px (seed de demo).

---

## 28. Gestión de stock: sin columna "Sugerencia de reestock"

- La tabla de alertas no entraba: el botón "Orden de Restock" quedaba cortado.
  Se quitó la columna de sugerencia, que ya muestra el modal de la orden (la
  precarga y explica el cálculo). Quedan Producto, SKU, Stock actual, Punto de
  reposición, Ya pedido y Acciones.
- La descripción del panel ahora aclara que la sugerida se precarga al crear la
  orden. Se quitó el CSS que solo usaba esa columna.

---

## 29. Asignación de ubicación: categoría como filtro

- "Productos sin ubicación asignada" ya no tiene columna Categoría: pasa a un
  filtro detrás del botón "Filtros", como en las alertas de restock. Filtra en
  el backend (`POST /query/products`), así el contador y la paginación siguen
  siendo exactos.

---

## 30. Asignación de ubicación: botón "Ubicar"

- En "Productos de restock pendientes de ubicación", el botón "Ubicar
  mercadería" quedaba cortado. Pasa a "Ubicar".
- Verificado con capturas a 1366 px (seed de demo) de las dos pantallas.

---

## 31. Asignación de ubicación: solo mercadería recibida con remito

- **Antes:** la pantalla tenía también "Productos sin ubicación asignada", que
  ubicaba un producto nuevo cargándole un stock inicial directo en una posición:
  stock sin ninguna contrapartida (ni orden ni remito).
- **Ahora:** el flujo es alta del producto → orden de restock → remito →
  ubicación. La pantalla muestra solo "Productos de restock pendientes de
  ubicación", a lo ancho. El stock inicial de un producto que ya estaba en el
  depósito entra con un remito sin orden de restock.
- Se borró `ProductLocationModal`, junto con `restockService.getAvailablePositions`
  y `warehouseConfigService.assignProductToPosition`, que solo usaba ese modal.
- La tarjeta "Asignar stock" de Productos cuenta los remitos pendientes de
  ubicación (antes, productos sin ubicación). La de "Dar de alta producto" avisa
  que el stock entra con una orden de restock y su remito.

---

## 32. Remito de recepción: sin asignar ubicación

- El modal "Nuevo remito de recepción" ya no reparte la mercadería entre
  posiciones: solo registra lo recibido. El remito se guarda sin posiciones y
  queda pendiente de ubicación; se ubica después desde Asignación de ubicación,
  y recién ahí suma stock.
- Debajo del selector de orden, una nota explica "Sin orden asociada":
  mercadería que llega sin una orden de restock previa (stock inicial de un
  producto que ya estaba en el depósito, o una entrega no planificada).
- Se quitó la detección "¿el backend acepta remitos sin ubicar?"
  (`supportsPendingLocation` y la consulta a `GET /query/catalog`), que solo
  servía para ofrecer "Guardar sin ubicar"; también los mensajes de error de
  posiciones, que ya no pueden darse en el alta del remito.

---

## 33. Productos: tarjeta "Asignar stock" con todo lo pendiente de ubicación

- Descripción: "Ubicá la mercadería recibida con remito y la que hay que
  reubicar". El contador dice "N pendientes de ubicación" y cuenta todo lo que
  devuelve `listPendingLocation`: remitos y, cuando el backend las tenga,
  reubicaciones.
- Los textos que mandaban a cargar stock desde Asignación (alta de producto,
  ajuste sin posiciones) ahora dicen que el stock entra con un remito y se
  ubica desde Asignación de stock.

---

## 34. Asignación de stock: tabla "Productos pendientes de ubicación"

- Columnas como en Productos: Orden, Fecha, Imagen, Nombre, SKU, Cantidad a
  ubicar, Estado, Unidad y Acciones ("Asignar ubicación").
- Estado: "Restock aceptado" (verde) para un remito y "Reubicación" (azul) para
  lo que sale de quitar un producto de una posición. Una reubicación no tiene
  orden ("—"). El service ya lee `type` del remito (`RECEPTION_TYPE`); hasta
  que el backend lo mande, todo llega como remito. La fecha de una reubicación
  es la del momento en que se quitó el producto (pedido en
  `docs/nuevos_requisitos.md`, sección 1).
- La foto va centrada en su columna: nueva clase reutilizable
  `table-panel__thumb-cell` en `TablePanel.css`.

---

## 35. Asignación de stock: mismo título en el menú y en la pantalla

- La pantalla se llamaba "Asignación de ubicación" y el menú "Asignación de
  stock". Ahora las dos dicen "Asignación de stock", y el subtítulo coincide con
  la tarjeta de Productos.

---

## 36. Gestión de stock: alertas con columna Imagen y botón "Generar orden"

- La columna Producto se separa en Imagen y Producto (nombre hasta 2 líneas).
- El botón "Orden de Restock" pasa a "Generar orden".
- La foto va centrada en su columna (`table-panel__thumb-cell`).
- Verificado con capturas a 1366 px (seed de demo) de Asignación y Gestión de
  stock.

---

## 37. Productos: ordenar por SKU, Nombre y Categoría

- Los encabezados SKU, Nombre y Categoría son clickeables (flechas ▲▼): A→Z,
  Z→A y vuelta al orden por defecto (más nuevos primero). Ordena el backend
  (`sort` en `POST /query/products`) sobre todo el catálogo y vuelve a la
  página 1.
- Nuevo componente reutilizable `SortableHeader` (`src/components/ui/`), con
  `aria-sort`.
- Precio y stock no se pueden ordenar todavía: no están expuestos en la
  consulta. Quedó pedido en `docs/nuevos_requisitos.md`, sección 4, junto con
  ordenar los textos sin distinguir mayúsculas.
- En mobile la tabla se apila sin encabezados, así que ahí no se ordena.
- Verificado contra el backend (seed de demo): Nombre A→Z ordena el catálogo
  entero.

---

## 38. Revisión de endpoints contra Swagger

- Se compararon todas las llamadas del front (rutas, query params y campos del
  body) con `GET /v3/api-docs` del backend, y se probaron contra la seed los
  endpoints de lectura: todos responden 200 con la clave que lee cada service.
- **Corregido:** `productService.list` mandaba `is_active` y `GET /products`
  espera `isActive`. No cambiaba el resultado (el backend devuelve activos por
  defecto), pero el filtro se ignoraba.
- **Sin cambios, a propósito:** `GET /restock/orders` oculta las canceladas si
  no se pide `includeCancelled=true`; por eso Gestión de stock no ofrece el
  filtro "Cancelado".
- **Borrado (código muerto que ninguna pantalla usaba):** `vehicleService.update`
  y `vehicleService.remove`, que llamaban a `PATCH` y `DELETE /vehicles/{id}`
  (no existen en el backend), y `stockPositionService` entero.

---

## 39. Gestión de ventas: orden en el servidor y productos al expandir

- La tabla pasa de `GET /orders` (que no ordena: el front adivinaba el orden
  leyendo la lista desde el final) a `POST /query/orders`, que pagina y ordena
  en el servidor. Por defecto, más nuevas primero.
- Encabezados ordenables (`SortableHeader`): Fecha compra, Estado y Fecha
  despacho. Orden, Cliente y productos no se pueden ordenar en el backend.
- Esa consulta no trae los productos de cada orden. Por eso la fila ya no
  muestra Producto, SKU ni Cantidad: todas las órdenes tienen la flecha, y los
  productos se piden con `GET /orders/{id}` recién al expandir o al abrir "Ver
  detalle". Cada detalle se pide una sola vez. Reemplaza el desplegable de la
  entrada 27.
- El buscador de la página busca por orden o cliente (ya no por producto).
- Verificado contra la seed: ordenar por fecha ascendente arranca en la orden
  más vieja del rango de fechas, y al expandir carga los productos.

---

## 40. Perfil con `GET /users/me`

- El backend ya tiene `GET /users/me` (sección 3 de `nuevos_requisitos.md`).
  `userService.getMe` lo usa en lugar del `PATCH /users/me` con cuerpo vacío,
  que guardaba el usuario en cada lectura. Mismo `UserResponse`: Mi perfil no
  cambia.

---

## 41. Quitar producto de una posición: reubicación

- Al quitar un producto de una posición con stock, el backend crea en la misma
  transacción una recepción `type: RELOCATION` en `PENDING_LOCATION` con esas
  unidades (sección 1 de `nuevos_requisitos.md`). El front ya la mostraba en
  Asignación de stock con el estado "Reubicación" y sin orden.
- Cambia el texto de confirmación de "Quitar producto": ya no dice que el stock
  se descuenta, sino que las unidades quedan pendientes de reubicación y no
  cuentan en el stock disponible hasta que se ubiquen.
- Las sumas de "recibido" por orden siguen sin contar reubicaciones (se agrupan
  por `restock_order_id`, que una reubicación no tiene).

---

## 42. Vehículos: sin alta desde la pantalla

- Se sacó "Dar de alta vehículo" (botón del encabezado, botón de la tabla vacía
  y su modal). La pantalla queda solo de consulta: listado, búsqueda, filtro
  por estado y paginación.
- `vehicleService.register` y el permiso `vehicle.create` quedan sin uso en la
  UI; no se borraron para no tocar más archivos.

---

## Pendiente

- **Gestión de stock / Ventas** usan `productService.listAll()`
  (hasta 1000 productos en memoria) para cruzar el catálogo con órdenes y
  alertas. Funciona y avisa si se llega al tope, pero no escala con un catálogo
  muy grande. Resolverlo bien requiere agregaciones en el backend.
