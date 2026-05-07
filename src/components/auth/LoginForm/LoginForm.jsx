import Button from "../../ui/Button/Button";
import Input from "../../ui/Input/Input";

import "./LoginForm.css";

export default function LoginForm() {
  return (
    <form className="login-form">
      <h1>Iniciar sesión</h1>

      <p>Accedé a SmartWarehouse</p>

      <Input
        label="Correo electrónico"
        placeholder="Ingresá tu correo"
      />

      <Input
        label="Contraseña"
        type="password"
        placeholder="Ingresá tu contraseña"
      />

      <Button type="submit">
        Ingresar
      </Button>
    </form>
  );
}