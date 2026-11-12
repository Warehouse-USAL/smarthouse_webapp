# Nuevos requisitos para el backend

> Pedidos del front (`smarthouse_webapp`) a `wh-backend`. Anotado: 2026-11-12.

---

## 1. `GET /users/me`: leer el usuario logueado

### Por qué

La pantalla "Mi perfil" tiene que mostrar los datos del usuario logueado,
incluida la dirección y, para `PROVIDER`, el proveedor asignado. Hoy no hay una
forma limpia de leerlos:

- El login (`POST /auth/login`) devuelve solo `id`, `name`, `email` y `role`.
- `GET /users/{id}` es solo para `SUPERADMIN` y `ADMIN_SYSTEM`. Al resto de los
  roles le responde `403`, aunque pida su propio id.
- `PATCH /users/me` sí lo puede usar cualquier usuario logueado, pero es una
  escritura.

**Mientras tanto**, el front lee el perfil con `PATCH /users/me` y cuerpo `{}`:
como `UserService.updateMe` solo toca los campos no nulos, no cambia nada y
devuelve el usuario completo. Funciona, pero guarda el documento en cada
lectura (`userRepository.save`) y deja de servir si `PATCH /users/me` empieza a
validar campos obligatorios. Está aislado en `userService.getMe` para
reemplazarlo cuando exista este endpoint.

### Contrato pedido

```
GET /users/me
Authorization: Bearer <token>
```

- **Roles:** cualquier usuario autenticado (sin `@PreAuthorize`, igual que
  `PATCH /users/me` y `POST /users/me/change-password`).
- **Request:** sin parámetros ni cuerpo. El usuario sale del token
  (`authentication.getName()`), como en los otros endpoints `/me`.
- **Response `200`:** el mismo `UserResponse` que devuelven `GET /users/{id}` y
  `PATCH /users/me`, en snake_case:

```json
{
  "id": "6740c1f2a9b3e45d12f0a111",
  "email": "provider1@smartwarehouse.local",
  "name": "Distribuidora del Sur S.A.",
  "role": "PROVIDER",
  "active": true,
  "created_at": "2026-10-29T12:00:00Z",
  "address": {
    "street": "Av. Siempre Viva 742",
    "department": "B",
    "floor": "3",
    "postal_code": "1425"
  },
  "supplier": "Distribuidora del Sur S.A."
}
```

  - `address` es `null` si el usuario nunca la cargó.
  - `supplier` es `null` para todo rol que no sea `PROVIDER`, o para un
    `PROVIDER` sin proveedor asignado.
  - Nunca devuelve el hash de la contraseña.

- **Errores** (con el formato de siempre, `{ "error": { "code", "message" } }`):

| Status | Código | Cuándo |
| --- | --- | --- |
| `401` | — | Sin token o token vencido |
| `404` | `USER_NOT_FOUND` | El usuario del token ya no existe |

---

## 2. Color de cada zona del warehouse

### Por qué

En Configuración del warehouse cada zona se pinta de un color, pero ese color
no se guarda: el front lo deriva de un hash del `id_zone` sobre una paleta fija
de 4 colores. El usuario no lo puede elegir y, con más de 4 zonas (o por azar
del hash), dos zonas salen del mismo color.

Se pide guardar en la zona un color en hexadecimal, que el front lee y aplica
por CSS. Una zona sin color (`null`) sigue usando la paleta actual, así que las
zonas existentes no necesitan migración.

### Contrato pedido

- **Modelo:** `Zone` suma `color`, texto `#RRGGBB` (6 dígitos hexadecimales,
  guardado en mayúsculas) o `null`. No tiene que ser único.
- **Roles:** los de siempre de `ZoneController` (`SUPERADMIN`,
  `ADMIN_WAREHOUSE`).

**`POST /warehouse/zones`**: `color` opcional. Si no viene, queda `null`.

```json
{ "zone_code": "A", "max_allowed_lines": 4, "color": "#F59E0B" }
```

**`PATCH /warehouse/zones/{id}`**: `color` opcional, con la misma convención
que `supplier` en `PATCH /users/{id}`:

| Valor enviado | Resultado |
| --- | --- |
| Ausente o `null` | No cambia |
| `""` (vacío) | Borra el color (queda `null`) |
| `"#3b82f6"` | Se guarda como `#3B82F6` |

**`GET /warehouse/zones`**: es como el front lee las zonas (y sus colores) al
abrir la pantalla. Cada zona del listado suma `color`:

```json
{
  "zones": [
    {
      "id_zone": "z1",
      "zone_code": "A",
      "is_active": true,
      "max_allowed_lines": 4,
      "created_at": "2026-10-29T12:00:00Z",
      "color": "#F59E0B"
    },
    {
      "id_zone": "z2",
      "zone_code": "B",
      "is_active": true,
      "max_allowed_lines": 2,
      "created_at": "2026-10-29T12:00:00Z",
      "color": null
    }
  ]
}
```

`POST` y `PATCH` devuelven la zona con el mismo `color`, así el front pinta el
cambio sin volver a pedir el listado. Como es el mismo `ZoneResponse`, alcanza
con agregar el campo ahí.

Opcional: sumar `zone_color` a `PositionSummaryResponse`, que ya trae
`zone_code`, para pintar la zona de una posición sin pedir las zonas aparte.

- **Errores** (con el formato de siempre, `{ "error": { "code", "message" } }`):

| Status | Código | Cuándo |
| --- | --- | --- |
| `400` | `INVALID_ZONE_COLOR` | No cumple `^#[0-9A-Fa-f]{6}$` (ej. `"rojo"`, `"#FFF"`, `"F59E0B"`). Mensaje: "El color de la zona debe tener el formato #RRGGBB." |

Se pide un código propio y no el `VALIDATION_ERROR` genérico, que llega con el
mensaje en inglés.

---

## 3. Nombre del cliente en cada orden

### Por qué

La tabla de Gestión de ventas muestra el cliente de cada orden. La orden solo
trae `requested_by_user_id`, y el front arma el nombre pidiendo todos los
usuarios con `GET /users`, que es solo para `SUPERADMIN` y `ADMIN_SYSTEM`.
Para el resto de los roles que ven ventas (incluido `ADMIN_SALES`, el rol de
ventas) la columna Cliente sale "—" en todas las filas.

Además, traer todos los usuarios para resolver nombres no escala: es un listado
completo por cada carga de la pantalla.

### Contrato pedido

- **Roles:** sin cambios. El campo nuevo lo recibe cualquiera que ya pueda ver
  la orden.
- **`OrderResponse`** suma `requested_by_name`: el `name` actual del usuario
  que hizo la orden, o `null` si ese usuario ya no existe.

Aplica a las respuestas que devuelven órdenes: `GET /orders` (listado
paginado), `GET /orders/{id}`, `POST /orders` y `POST /orders/{id}/cancel`.

```json
{
  "id": "o1",
  "status": "pending",
  "requested_by_user_id": "u-sales-1",
  "requested_by_name": "Valentina Rodríguez",
  "items": [ ... ],
  "...": "resto de los campos sin cambios"
}
```

En el listado conviene resolver los nombres de la página de una sola vez (un
`findAllById` con los ids de esa página), no un pedido por orden.

- **Errores:** ninguno nuevo.

---

## 4. "Quitar producto" de una posición con stock: reubicación

### Por qué

Hoy `PATCH /warehouse/positions/{id}` con `{ "unassign_product": true }` pone la
posición en 0 y registra un ajuste `UNASSIGNED`: para el sistema, esas unidades
salieron del depósito. Pero sacar un producto de una posición no significa que
la mercadería desaparezca: sigue físicamente en el depósito y hay que ubicarla
en otra posición.

Ejemplo: un producto tiene 150 unidades, 100 en la posición 001. Al quitarlo de
la 001, hoy queda con 50 y las 100 se pierden del registro.

Hacerlo desde el front con dos pedidos (quitar + crear un remito sin orden) no
es seguro: si el segundo falla, las 100 unidades se pierden, y además quedaría
registrado un remito de proveedor que no existió.

### Comportamiento pedido

Al quitar el producto de una posición con stock, en **la misma transacción**:

1. La posición queda sin producto y en 0, como hoy.
2. Se crea un pendiente de ubicación de tipo **reubicación** por esas unidades,
   que se ubica igual que un remito: `PATCH /restock/receptions/{id}` con
   `assignments`.
3. El historial de ajustes registra la salida (`UNASSIGNED`) como hoy, y la
   reubicación queda vinculada a la posición de origen.

Las unidades pendientes de ubicación **no cuentan** en el stock del producto
hasta que se ubican, igual que un remito `PENDING_LOCATION`. La reconciliación
de pedidos sigue funcionando como hoy.

Para dar de baja unidades de verdad (rotura, pérdida) ya existe
`POST /warehouse/positions/{id}/stock-adjustments`.

### Contrato pedido

- **Roles:** sin cambios (los de `PATCH /warehouse/positions/{id}`).
- **`Reception`** suma dos campos:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `type` | `SUPPLIER` o `RELOCATION` | `SUPPLIER` para los remitos de siempre (valor por defecto, también para los existentes) |
| `source_position_id` | texto o `null` | Posición de la que salió una reubicación. `null` en un remito de proveedor |

Una reubicación tiene `restock_order_id: null`, `supplier: null`,
`quantity_received` = el stock que tenía la posición, `delivery_unit` = el
`size_stock_to_save` de la posición y `status: PENDING_LOCATION`.

**`PATCH /warehouse/positions/{id}`** con `unassign_product: true`: si la
posición tenía stock, la respuesta suma el remito creado.

```json
{
  "...": "posición actualizada, como hoy",
  "cancelled_orders": [],
  "relocation": {
    "id": "r9",
    "type": "RELOCATION",
    "product_id": "p1",
    "quantity_received": 100,
    "delivery_unit": "CAJA",
    "status": "PENDING_LOCATION",
    "source_position_id": "pos-001",
    "restock_order_id": null,
    "supplier": null
  }
}
```

Con la posición en 0, `relocation` es `null`.

**`GET /restock/receptions`** (y `GET /restock/receptions/{id}`): cada remito
suma `type` y `source_position_id`. Así la tabla de Asignación de ubicación
muestra las reubicaciones junto a los remitos, con estado "Reubicación". Se
pide además el filtro `type` en el listado, para que los reportes de compras a
proveedores puedan excluir las reubicaciones.

- **Errores:** ninguno nuevo.
