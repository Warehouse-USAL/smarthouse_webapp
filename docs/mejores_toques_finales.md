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

## Pendiente

- **Gestión de stock / Asignación de stock / Ventas** usan `productService.listAll()`
  (hasta 1000 productos en memoria) para cruzar el catálogo con órdenes y
  alertas. Funciona y avisa si se llega al tope, pero no escala con un catálogo
  muy grande. Resolverlo bien requiere agregaciones en el backend.
- `productService.list` manda `is_active`, pero `GET /products` espera
  `isActive`: el parámetro se ignora y siempre llegan activos. Hoy no afecta a
  nadie (los que lo usan piden activos).
