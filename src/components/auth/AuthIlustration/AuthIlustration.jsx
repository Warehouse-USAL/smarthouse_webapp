import "./AuthIlustration.css";

import logo from "../../../assets/Logos/Logo_con_Nombre_(sin fondo).png";


export default function AuthIlustration({
  title,
  body,
  image,
}) {
  return (
    <div className="auth_ilustration">
      <div className="auth_ilustration_header">
          <img src={logo} alt="" />
      </div>
      <div className="auth_ilustration_content">
        <h2>{title}</h2>
        <p>{body}</p>
      </div>


      <div className="auth_ilustration_image">
        <img src={image} alt="hero" />
      </div>
    </div>
  );
}