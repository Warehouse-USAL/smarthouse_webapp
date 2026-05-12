import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Button from "../../../../components/ui/Button/Button";

import hero from "../../../../assets/ImagenInicioLogin.png";

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
        title="Correo enviado"
        subtitle="Revisá tu bandeja de entrada o spam."
      >
        <Button type="button" onClick={onNext}>
          Ya lo recibí
        </Button>
      </LoginForm>
    ),
  };
}