import { Navigate, Outlet } from "react-router-dom";
import { can } from "../lib/permissions";

/*
|--------------------------------------------------------------------------
| REQUIRE CAPABILITY
|--------------------------------------------------------------------------
|
| Guard de ruta por permiso. Va anidado dentro de ProtectedRoute (ya hay
| sesión); acá chequeamos que el rol pueda acceder al módulo. Si no, redirige
| a /inicio en vez de mostrar una pantalla que el backend rechazaría con 403.
|
*/

export default function RequireCapability({ capability }) {
  if (!can(capability)) {
    return <Navigate to="/inicio" replace />;
  }
  return <Outlet />;
}
