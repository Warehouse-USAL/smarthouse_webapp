import Button from "../../ui/Button/Button";
import Input from "../../ui/Input/Input";

import mail from "../../../assets/mail.svg";
import lock from "../../../assets/lock.svg";

import "./LoginForm.css";

export default function LoginForm() {
  return (
    <form className="login-form">
      <h1>Iniciar sesión</h1>
      <h3>Accedé a SmartWarehouse</h3>
 
      {/* EMAIL */}
      <Input
  label="Correo electrónico"
  placeholder="Ingresá tu correo"
  iconLeft={<img src={mail} alt="mail" />}
/>

      {/* PASSWORD */}
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
    </form>
  );
}