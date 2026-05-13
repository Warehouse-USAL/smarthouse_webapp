import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import { Link } from "react-router-dom";

import hero from "../../../../assets/auth/CorreoEnviado_step2.png";
import mailSentIcon from "../../../../assets/auth/IconoCorreoEnviado_step2.png";

export default function Step2LinkSent(onNext) {
  return {
    leftContent: (
      <AuthIlustration
        title="Revisá tu correo"
        body="Te enviamos un enlace para restablecer tu contraseña."
        image={hero}
      />
    ),

    rightContent: (
      <LoginForm

        topContent={
          <img
            src={mailSentIcon}
            alt="correo enviado"
            className="mail_sent_image"
          />
        }

        title="¡Enlace enviado!"

        subtitle="Si el correo existe en nuestro sistema, vas a recibir un enlace para restablecer tu contraseña."
      >

        <a className="volverSesion">
          Reenviar enlace
        </a>

        <Link to="/login" className="volverSesion">
          Volver al inicio de sesión
        </Link>

        <p onClick={onNext}>
          boton harcodeado, pulse para seguir la secuencia
        </p>

      </LoginForm>
    ),
  };
}