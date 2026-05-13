import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Button from "../../../../components/ui/Button/Button";

import { Link } from "react-router-dom";

import hero from "../../../../assets/auth/ContraseniaRestablecida_step4.png";
import succesIcon from "../../../../assets/auth/IconoSeguroCandado_step4.png";

export default function Step4Success() {
  return {
    leftContent: (
      <AuthIlustration
        title="¡Contraseña restablecida!"
        body="Ya podés iniciar sesión y volver a gestionar tus órdenes."
        image={hero}
      />
    ),

    rightContent: (



      
      <LoginForm

        topContent={
          <img
            src={succesIcon}
            alt="correo enviado"
            className="mail_sent_image"
          />
        }


        title="Listo, ya podés inciar sesión"
        subtitle="Tu contraseña fue actualizada correctamente."
      >
        <Link to="/login">
          <Button type="button">
            Ir al inicio de sesión
          </Button>
        </Link>
      </LoginForm>
    ),
  };
}