import LoginForm from "../LoginForm/LoginForm";
import AuthIlustration from "../AuthIlustration/AuthIlustration"

import "./AuthLayout.css";
import hero from "../../../assets/ImagenInicioLogin.png";


import Button from "../../ui/Button/Button";
import Input from "../../ui/Input/Input";

import mail from "../../../assets/mail.svg";
import lock from "../../../assets/lock.svg";



export default function AuthLayout() {
  return (
    <div class="container_login">
      <div className="left_login">
        <AuthIlustration
          title="Gestión inteligente para tu almacén"
          body="Controlá órdenes, vehículos y monitoreo en tiempo real desde un solo lugar."
          image={hero}>
        </AuthIlustration>
      </div>
      <div className="right_login">
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

          <a href="" className="olvido_contrasenia">
            ¿Olvidaste tu contraseña?
          </a>

          <Button type="submit">
            Ingresar
          </Button>

          <a href="" className="registrar_proveedor">
            ¿Querés sumarte como proveedor?
          </a>
        </LoginForm>
      </div>
    </div>
  );
}