import LoginForm from "../LoginForm/LoginForm";
import AuthIlustration from "../AuthIlustration/AuthIlustration"

import "./AuthLayout.css";

export default function AuthLayout() {
  return (
   <div class="container_login">
    <div className="left_login">
      {/* aca le tengo que pasar al authIlustartion 3 cosas. 1) Titulo de la ilustracion 2) Cuerpo de la ilustracion 3) Foto de la ilustracion */}
      <AuthIlustration></AuthIlustration>
    </div>
    <div className="right_login">
      <LoginForm></LoginForm>
    </div>
   </div>
  );
}