import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Input from "../../../../components/ui/Input/Input";
import Button from "../../../../components/ui/Button/Button";
import { Link } from "react-router-dom";

import hero from "../../../../assets/auth/RestablecerContrasenia_step3.png";
import lock from "../../../../assets/icons/lock.svg";

export default function Step3ResetPassword(onNext) {
  return {
    leftContent: (
      <AuthIlustration
        title="Restablecé tu contraseña"
        body="Creá una nueva contraseña para proteger tu cuenta."
        image={hero}
      />
    ),

    rightContent: (
      <LoginForm
        title="Restablecer contraseña"
        subtitle="Creá una nueva contraseña segura para tu cuenta."
      >
        <Input
        variant="auth"
          label="Nueva contraseña"
          type="password"
          placeholder="Ingresá tu nueva contraseña"
          iconLeft={<img src={lock} alt="lock" />}
        />

        <Input
        variant="auth"
          label="Confirmar nueva contraseña"
          type="password"
          placeholder="Confirmá tu contraseña"
          iconLeft={<img src={lock} alt="lock" />}
        />

        <Button type="button" onClick={onNext}>
          Restablecer contraseña
        </Button>

        <Link to="/login" className="volverSesion">
          Volver al inicio de sesión
        </Link>
      </LoginForm>
    ),
  };
}