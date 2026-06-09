import { useState } from "react";

import AuthLayout from "../../../components/auth/AuthLayout/AuthLayout";
import AuthIlustration from "../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../components/auth/LoginForm/LoginForm";

import Button from "../../../components/ui/Button/Button";
import Input from "../../../components/ui/Input/Input";
import StatusBanner from "../../../components/ui/StatusBanner/StatusBanner";

import hero from "../../../assets/auth/ImagenInicioLogin.png";

import mail from "../../../assets/icons/mail.svg";
import lock from "../../../assets/icons/lock.svg";

import { Link, useNavigate, useLocation } from "react-router-dom";

import { login } from "../../../services/authService";

import "./LoginPage.css";

export default function LoginPage() {

  const navigate = useNavigate();

  const location = useLocation();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const [isLoading, setIsLoading] =
    useState(false);



  /*
  |--------------------------------------------------------------------------
  | HANDLE INPUT CHANGE
  |--------------------------------------------------------------------------
  */

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };



  /*
  |--------------------------------------------------------------------------
  | HANDLE SUBMIT
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");

    setIsLoading(true);

    try {

      const data = await login(
        formData.email,
        formData.password
      );



      /*
      |--------------------------------------------------------------------------
      | SAVE AUTH DATA
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );



      console.log(
        "LOGIN OK",
        data
      );



      /*
      |--------------------------------------------------------------------------
      | REDIRECCIÓN POST-LOGIN
      |--------------------------------------------------------------------------
      | Si el usuario fue redirigido al login desde una ruta protegida,
      | lo devolvemos ahí. Si no, va al inicio.
      */

      const from = location.state?.from?.pathname || "/inicio";

      navigate(from, { replace: true });

    }

    catch (err) {

      /*
      |--------------------------------------------------------------------------
      | ACCOUNT BLOCKED
      |--------------------------------------------------------------------------
      */

      if (
        err.code === "ACCOUNT_BLOCKED"
      ) {

        navigate("/account-blocked");

        return;

      }



      /*
      |--------------------------------------------------------------------------
      | GENERIC ERROR
      |--------------------------------------------------------------------------
      */

      setError(
        err.message ||
        "❌ Ocurrió un error inesperado."
      );

    }

    finally {

      setIsLoading(false);

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
            variant="auth"
              name="email"

              value={formData.email}
              onChange={handleChange}

              label="Correo electrónico"

              type="email"

              placeholder="Ingresá tu correo"

              iconLeft={
                <img
                  src={mail}
                  alt="mail"
                />
              }

              required
            />



            <Input
            variant="auth"
              name="password"

              value={formData.password}
              onChange={handleChange}

              label="Contraseña"

              type="password"

              placeholder="Ingresá tu contraseña"

              iconLeft={
                <img
                  src={lock}
                  alt="lock"
                />
              }

              required
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



            <Button
              type="submit"
              disabled={isLoading}
            >

              {
                isLoading
                  ? "Ingresando..."
                  : "Ingresar"
              }

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