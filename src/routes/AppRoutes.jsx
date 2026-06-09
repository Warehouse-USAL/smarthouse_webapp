import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage/ForgotPasswordPage";
import AccountBlockedPage from "../pages/auth/AccountBlockedPage/AccountBlockedPage";

// import RegisterProviderPage from "../pages/auth/RegisterProviderPage/RegisterProviderPage";
import HomePage from "../pages/Home/HomePage";
import ProductsPage from "../pages/Products/ProductsPage";
import WarehouseConfigPage from "../pages/WarehouseConfig/WarehouseConfigPage";
import VehiclesPage from "../pages/Vehicles/VehiclesPage";
import StockAssignmentPage from "../pages/StockAssignment/StockAssignmentPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* redirect base */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* AUTH ROUTES (públicas) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/account-blocked" element={<AccountBlockedPage />} />
        {/* <Route path="/registro-proveedor" element={<RegisterProviderPage />} /> */}

        {/* RUTAS PROTEGIDAS (requieren sesión) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/inicio" element={<HomePage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/configuracion" element={<WarehouseConfigPage />} />
            <Route path="/asignacion-stock" element={<StockAssignmentPage />} />
            <Route path="/vehiculos" element={<VehiclesPage />} />
          </Route>
        </Route>

        {/* cualquier otra ruta cae al guard: si hay sesión va a /inicio, si no a /login */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}