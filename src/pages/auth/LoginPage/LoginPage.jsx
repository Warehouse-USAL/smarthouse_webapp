import AuthLayout from "../../../components/auth/AuthLayout/AuthLayout";
import AuthIlustration from "../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../components/auth/LoginForm/LoginForm";

import Button from "../../../components/ui/Button/Button";
import Input from "../../../components/ui/Input/Input";

import hero from "../../../assets/ImagenInicioLogin.png";
import mail from "../../../assets/mail.svg";
import lock from "../../../assets/lock.svg";

import { Link } from "react-router-dom";

import "./LoginPage.css";

export default function LoginPage() {
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
          >
            <Input
              label="Correo electrónico"
              placeholder="Ingresá tu correo"
              iconLeft={<img src={mail} alt="mail" />}
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="Ingresá tu contraseña"
              iconLeft={<img src={lock} alt="lock" />}
            />

            <Link to="/forgot-password" className="olvido_contrasenia">
              ¿Olvidaste tu contraseña?
            </Link>

            <Button type="submit">
              Ingresar
            </Button>

            <Link to="/register-provider" className="registrar_proveedor">
              ¿Querés sumarte como proveedor?
            </Link>
          </LoginForm>
        }
      />
    </div>
  );
}