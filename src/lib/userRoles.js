/*
|--------------------------------------------------------------------------
| USER ROLES — espejo del enum UserRole del backend (wh-backend)
|--------------------------------------------------------------------------
|
| El backend valida el rol contra el enum UserRole. Viaja como string con el
| nombre EXACTO del enum (SUPERADMIN, ADMIN_SYSTEM, ...). Acá mantenemos el
| espejo en el front: el `value` debe coincidir 1:1 con el enum del backend;
| `label` y `variant` (color del Badge) son solo presentación.
|
| No hay endpoint que liste roles → esta es la única fuente de verdad en el
| front. Si el backend agrega un rol, agregarlo también acá.
|
*/

export const USER_ROLES = [
  { value: "SUPERADMIN", label: "Superadministrador", variant: "danger" },
  { value: "ADMIN_SYSTEM", label: "Administrador de sistema", variant: "info" },
  { value: "ADMIN_WAREHOUSE", label: "Administrador de depósito", variant: "zone-c" },
  { value: "ADMIN_SALES", label: "Administrador de ventas", variant: "zone-d" },
  { value: "PROVIDER", label: "Proveedor", variant: "warning" },
  { value: "DISPATCHER", label: "Despachante", variant: "zone-b" },
  { value: "OPERATOR", label: "Operario", variant: "neutral" },
];

const ROLE_MAP = USER_ROLES.reduce((acc, r) => {
  acc[r.value] = r;
  return acc;
}, {});

// El backend serializa el rol tal cual el enum (mayúsculas). El mock de login
// viejo guardaba "admin_sales" en minúsculas → normalizamos para que matchee.
export const normalizeRole = (role) => String(role ?? "").trim().toUpperCase();

export const roleLabel = (role) =>
  ROLE_MAP[normalizeRole(role)]?.label ?? role ?? "—";

export const roleVariant = (role) =>
  ROLE_MAP[normalizeRole(role)]?.variant ?? "neutral";

export const ROLE_OPTIONS = USER_ROLES.map((r) => ({
  value: r.value,
  label: r.label,
}));
