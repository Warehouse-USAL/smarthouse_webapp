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

