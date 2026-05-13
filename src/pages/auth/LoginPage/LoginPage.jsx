import { useState } from "react";

import AuthLayout from "../../../components/auth/AuthLayout/AuthLayout";
import AuthIlustration from "../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../components/auth/LoginForm/LoginForm";

import Button from "../../../components/ui/Button/Button";
import Input from "../../../components/ui/Input/Input";

import hero from "../../../assets/auth/ImagenInicioLogin.png";
import mail from "../../../assets/icons/mail.svg";
import lock from "../../../assets/icons/lock.svg";

import StatusBanner from "../../../components/ui/StatusBanner/StatusBanner";

import { Link, useNavigate } from "react-router-dom";

import { login } from "../../../services/authService";

import "./LoginPage.css";

export default function LoginPage() {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    try {

      const data = await login(
        formData.email,
        formData.password
      );

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      console.log("LOGIN OK", data);

      navigate("/dashboard");

    } catch (err) {

      if (err.code === "ACCOUNT_BLOCKED") {

        navigate("/account-blocked");

        return;

      }

      setError(err.message);

    }

  };

  return (
    <div className="container_center_login">

      <AuthLayout
        leftContent={
          <AuthIlustration
            title="Gestión inteligente para tu almacén"
            body="Controlá órdenes, vehículos y monitoreo en tiempo real desde un solo lugar."
            image={hero}
          />
        }

        rightContent={

          <LoginForm
            title="Iniciar sesión"
            subtitle="Accedé a SmartWarehouse"
            onSubmit={handleSubmit}
          >

            <Input
              name="email"
              value={formData.email}
              onChange={handleChange}

              label="Correo electrónico"
              placeholder="Ingresá tu correo"
              iconLeft={<img src={mail} alt="mail" />}
            />

            <Input
              name="password"
              value={formData.password}
              onChange={handleChange}

              label="Contraseña"
              type="password"
              placeholder="Ingresá tu contraseña"
              iconLeft={<img src={lock} alt="lock" />}
            />

            {error && (
              <StatusBanner
                icon="❌"
                text={error}
                statusBannerState="status-banner-error"
              />
            )}

            <Link
              to="/forgot-password"
              className="olvido_contrasenia"
            >
              ¿Olvidaste tu contraseña?
            </Link>

            <Button type="submit">
              Ingresar
            </Button>

            <Link
              to="/register-provider"
              className="registrar_proveedor"
            >
              ¿Querés sumarte como proveedor?
            </Link>

          </LoginForm>

        }
      />

    </div>
  );
}