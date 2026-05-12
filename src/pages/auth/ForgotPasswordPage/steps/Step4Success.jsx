import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Button from "../../../../components/ui/Button/Button";

import { Link } from "react-router-dom";

import hero from "../../../../assets/ImagenInicioLogin.png";

export default function Step4Success() {
  return {
    leftContent: (
      <AuthIlustration
        title="¡Contraseña actualizada!"
        body="Ya podés volver a ingresar a tu cuenta."
        image={hero}
      />
    ),

    rightContent: (
      <LoginForm
        title="Proceso completado"
        subtitle="Tu contraseña fue restablecida correctamente."
      >
        <Link to="/login">
          <Button type="button">
            Volver al login
          </Button>
        </Link>
      </LoginForm>
    ),
  };
}