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

## Pendiente

- **Gestión de stock / Ventas** usan `productService.listAll()`
  (hasta 1000 productos en memoria) para cruzar el catálogo con órdenes y
  alertas. Funciona y avisa si se llega al tope, pero no escala con un catálogo
  muy grande. Resolverlo bien requiere agregaciones en el backend.
- `productService.list` manda `is_active`, pero `GET /products` espera
  `isActive`: el parámetro se ignora y siempre llegan activos. Hoy no afecta a
  nadie (los que lo usan piden activos).
