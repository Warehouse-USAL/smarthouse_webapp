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
