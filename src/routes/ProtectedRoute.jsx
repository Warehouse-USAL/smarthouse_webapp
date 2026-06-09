import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "../services/authService";

/*
|--------------------------------------------------------------------------
| PROTECTED ROUTE
|--------------------------------------------------------------------------
|
| Envuelve las rutas privadas. Si no hay token de sesión, redirige a /login
| y guarda la ubicación de origen para volver tras loguearse.
|
*/

export default function ProtectedRoute() {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
