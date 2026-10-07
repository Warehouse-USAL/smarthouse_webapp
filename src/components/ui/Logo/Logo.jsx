import "./Logo.css";
import logoUrl from "../../../assets/logos/Logo_(sin fondo).png";

export default function Logo({ size = "md" }) {
  return (
    <div className={`logo logo--${size}`}>
      <img src={logoUrl} alt="SmartWarehouse" />
      <span className="logo__text">SmartWarehouse</span>
    </div>
  );
}
