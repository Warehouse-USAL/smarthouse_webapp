import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout/AppLayout";
import LoginPage from "../pages/auth/LoginPage/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage/ForgotPasswordPage";
import AccountBlockedPage from "../pages/auth/AccountBlockedPage/AccountBlockedPage";

// import RegisterProviderPage from "../pages/auth/RegisterProviderPage/RegisterProviderPage";
import HomePage from "../pages/Home/HomePage";
import ProductsPage from "../pages/Products/ProductsPage";
import WarehouseConfigPage from "../pages/WarehouseConfig/WarehouseConfigPage";
import VehiclesPage from "../pages/Vehicles/VehiclesPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/configuracion" element={<WarehouseConfigPage />} />
          <Route path="/vehiculos" element={<VehiclesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/inicio" replace />} />
                {/* redirect base */}
                <Route path="/" element={<Navigate to="/login" />} />

          {/* AUTH ROUTES */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/account-blocked" element={<AccountBlockedPage />} />

          {/* <Route path="/registro-proveedor" element={<RegisterProviderPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
