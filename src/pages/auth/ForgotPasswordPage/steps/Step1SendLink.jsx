import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Input from "../../../../components/ui/Input/Input";
import Button from "../../../../components/ui/Button/Button";

import { Link } from "react-router-dom";

import hero from "../../../../assets/ImagenInicioLogin.png";
import mail from "../../../../assets/mail.svg";

export default function Step1SendLink(onNext) {
  return {
    leftContent: (
      <AuthIlustration
        title="Recuperá el acceso a tu cuenta"
        body="Te ayudamos a restablecer tu contraseña de forma rápida y segura."
        image={hero}
      />
    ),

    rightContent: (
      <LoginForm
        title="Recuperar contraseña"
        subtitle="Ingresá tu correo electrónico y te enviaremos un enlace."
      >
        <Input
          label="Correo electrónico"
          placeholder="Ingresá tu correo"
          iconLeft={<img src={mail} alt="mail" />}
        />

        <Button type="button" onClick={onNext} >
          Enviar enlace
        </Button>

        <Link to="/login" className="volverSesion">
          Volver al inicio de sesión
        </Link>
      </LoginForm>
    ),
  };
}