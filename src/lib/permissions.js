/*
|--------------------------------------------------------------------------
| PERMISOS — espejo de los @PreAuthorize del backend (wh-backend)
|--------------------------------------------------------------------------
|
| El backend es la fuente de verdad: cada Controller declara con @PreAuthorize
| qué roles pueden ejecutar cada acción y rechaza con 403 al resto. Acá
| replicamos esa matriz para ESCONDER en la UI lo que el rol no puede hacer
| (evitar 403 ruidosos), NO para reemplazar la validación: el backend sigue
| siendo quien autoriza de verdad.
|
| Cada capacidad mapea a la lista de roles permitidos. Convención:
|   - lista de roles → solo esos roles
|   - null           → cualquier usuario autenticado (endpoint sin @PreAuthorize)
|   - capacidad ausente → denegada (can() devuelve false)
|
| Si el backend cambia una regla, actualizar acá. Referencias de cada regla:
|   product.*    ProductController  (POST/PATCH: +ADMIN_SALES; DELETE: no SALES)
|   warehouse.*  Zone/Line/PositionController (anotación a nivel de clase)
|   stock.assign PATCH /warehouse/positions/:id (mismos roles que warehouse)
|   vehicle.*    VehicleController  (read: +ADMIN_WAREHOUSE; create: solo SYSTEM)
|   user.*       UserController
|
*/

import { getUser } from "../services/authService";
import { normalizeRole } from "./userRoles";

export const CAPABILITIES = {
  // Productos
  "product.read": null,
  "product.create": ["SUPERADMIN", "ADMIN_WAREHOUSE", "ADMIN_SALES"],
  "product.edit": ["SUPERADMIN", "ADMIN_WAREHOUSE", "ADMIN_SALES"],
  "product.delete": ["SUPERADMIN", "ADMIN_WAREHOUSE"],

  // Warehouse: zonas, líneas y posiciones (CRUD)
  "warehouse.read": ["SUPERADMIN", "ADMIN_WAREHOUSE"],
  "warehouse.manage": ["SUPERADMIN", "ADMIN_WAREHOUSE"],

  // Asignación de stock (PATCH posiciones)
  "stock.assign": ["SUPERADMIN", "ADMIN_WAREHOUSE"],

  // Vehículos
  "vehicle.read": ["SUPERADMIN", "ADMIN_SYSTEM", "ADMIN_WAREHOUSE"],
  "vehicle.create": ["SUPERADMIN", "ADMIN_SYSTEM"],

  // Usuarios
  "user.read": ["SUPERADMIN", "ADMIN_SYSTEM"],
  "user.manage": ["SUPERADMIN", "ADMIN_SYSTEM"],
};

// Rol del usuario logueado (normalizado al enum del backend), o "" si no hay sesión.
export const currentRole = () => normalizeRole(getUser()?.role);

/**
 * ¿El rol tiene permiso para la capacidad?
 * @param {string} capability  clave de CAPABILITIES
 * @param {string} [role]      rol a evaluar; por defecto el del usuario logueado
 */
export function can(capability, role = currentRole()) {
  const allowed = CAPABILITIES[capability];
  if (allowed === undefined) return false; // capacidad desconocida → denegar
  if (allowed === null) return Boolean(role); // cualquier autenticado
  return allowed.includes(normalizeRole(role));
}
