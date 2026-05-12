import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginPage from "../pages/auth/LoginPage/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage/ForgotPasswordPage";
// import RegisterProviderPage from "../pages/auth/RegisterProviderPage/RegisterProviderPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* redirect base */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* AUTH ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* <Route path="/registro-proveedor" element={<RegisterProviderPage />} /> */}

      </Routes>
    </BrowserRouter>
  );
}