# Pendiente — próxima sesión

> Rama: `feature/toques-finales` | Anotado: 2026-11-11 | Para: 2026-11-12

---

## 1. Revisar las alertas de restock y la cantidad sugerida

**Qué revisar:** que las alertas de Gestión de stock se generen bien y que la
cantidad sugerida aparezca correcta.

- Probar con la seed de demo (`SEED_DEMO=true`), que tiene demanda real: los
  productos con ventas deberían traer `should_restock` y `suggested_quantity`
  del backend.
- Confirmar que la cantidad sugerida que muestra la tabla de alertas coincide
  con la que precarga el modal de orden de restock, tanto desde Gestión de stock
  como desde el botón nuevo de la tabla de Productos.
- Revisar el caso sin demanda: el backend no sugiere nada (`gap = 0`). Ver que
  la UI lo muestre claro y no quede una tabla vacía sin explicación.
- Pendiente viejo a verificar: en `StockManagementPage`, `listAlerts` puede
  devolver `[]` en vez de `null` y entonces no cae al cálculo local por stock
  mínimo.

---

## 2. Stock negativo

**Estado:** el backend ya valida que el stock no quede negativo.

- Verificar en el front que el error que devuelve el backend al intentarlo se
  muestre con un mensaje claro (ajuste manual en Productos, recepciones).
- El modal de ajuste de stock ya impide reducir más que el stock actual de la
  posición; confirmar que no haya otro camino en la UI que lo permita.

---

## 3. Perfil de usuario usando todos los endpoints de Users

**Idea:** armar una sección "Mi perfil" aprovechando lo que el backend ya
expone y el front todavía no usa.

| Endpoint | Para qué | ¿Lo usa el front? |
| --- | --- | --- |
| `GET /users` | Listado (admin) | Sí, en Usuarios |
| `GET /users/{id}` | Detalle de un usuario | Sí, en el service |
| `POST /users` | Alta (admin) | Sí |
| `PATCH /users/{id}` | Edición (admin) | Sí |
| `POST /users/{id}/reset-password` | Reset por un admin | Sí |
| `POST /users/me/change-password` | El usuario cambia su propia contraseña (`current_password`, `new_password`) | **No** |
| `PATCH /users/me` | El usuario edita su nombre y dirección | **No** |

**A definir mañana:**

- Pantalla o modal "Mi perfil" desde el menú del avatar: ver datos (nombre,
  email, rol, proveedor si es `PROVIDER`), editar nombre y dirección, y cambiar
  la contraseña.
- Errores a traducir de `change-password`: `WRONG_CURRENT_PASSWORD`,
  `SAME_PASSWORD`.
- Verificar qué roles pueden leer su propio detalle: no hay `GET /users/me`, y
  `GET /users/{id}` puede requerir rol admin. Si no, el perfil se arma con el
  usuario guardado al loguearse y se actualiza con la respuesta de
  `PATCH /users/me`.
