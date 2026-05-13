import AuthLayout from "../../../components/auth/AuthLayout/AuthLayout";
import AuthIlustration from "../../../components/auth/AuthIlustration/AuthIlustration";
import LoginForm from "../../../components/auth/LoginForm/LoginForm";

import StatusBanner from "../../../components/ui/StatusBanner/StatusBanner"

import Button from "../../../components/ui/Button/Button";
import Input from "../../../components/ui/Input/Input";

import hero from "../../../assets/auth/ImagenBloqueoCuenta.png";
import mail from "../../../assets/icons/mail.svg";
import lockIcon from "../../../assets/icons/lock.svg";

import { Link } from "react-router-dom";

import "./AccountBlockedPage.css";

export default function AccountBlockedPage() {
  return (
    <div className="container_center_login">
      <AuthLayout
        leftContent={
          <AuthIlustration
            title="Seguridad de acceso"
            body="Protegemos tu cuenta y la información de tu almacén con medidas inteligentes."
            image={hero}
          />
        }

        rightContent={

          
          <LoginForm
            title="Cuenta bloqueada temporalmente"
            subtitle="La cuenta fue bloqueada por 24hs como medida de seguridad, ya que se registraron 5 intentos erróneos de acceder a la cuenta.\nPasado ese tiempo, podrás volver a intentarlo."
          >


            
            <Link to="/login">
                <Button type="submit">
                Volver al inicio
                </Button>
            </Link>
          </LoginForm>
        }
      />
    </div>
  );
}