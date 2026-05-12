import AuthIlustration from "../../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../../components/auth/LoginForm/LoginForm";

import Input from "../../../../components/ui/Input/Input";
import Button from "../../../../components/ui/Button/Button";

import hero from "../../../../assets/ImagenInicioLogin.png";
import lock from "../../../../assets/lock.svg";

export default function Step3ResetPassword(onNext) {
  return {
    leftContent: (
      <AuthIlustration
        title="Elegí una nueva contraseña"
        body="Usá una contraseña segura y fácil de recordar."
        image={hero}
      />
    ),

    rightContent: (
      <LoginForm
        title="Nueva contraseña"
        subtitle="Ingresá y confirmá tu nueva contraseña."
      >
        <Input
          label="Nueva contraseña"
          type="password"
          placeholder="Ingresá tu nueva contraseña"
          iconLeft={<img src={lock} alt="lock" />}
        />

        <Input
          label="Confirmar contraseña"
          type="password"
          placeholder="Confirmá tu contraseña"
          iconLeft={<img src={lock} alt="lock" />}
        />

        <Button type="button" onClick={onNext}>
          Restablecer contraseña
        </Button>
      </LoginForm>
    ),
  };
}