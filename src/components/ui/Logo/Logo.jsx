import "./Logo.css";

export default function Logo({ size = "md" }) {
  return (
    <div className={`logo logo--${size}`}>
      <img src="src\assets\logos\Logo_(sin fondo).png" alt="LogoSinFondo" />
      <span className="logo__text">SmartWarehouse</span>
    </div>
  );
}
