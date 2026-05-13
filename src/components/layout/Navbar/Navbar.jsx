import { NavLink } from "react-router-dom";
import Logo from "../../ui/Logo/Logo";
import "./Navbar.css";

const NAV_ITEMS = [
  { to: "/inicio", label: "Inicio" },
  { to: "/productos", label: "Productos" },
  { to: "/configuracion", label: "Configuración del warehouse" },
  { to: "/vehiculos", label: "Vehículos" },
];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Logo />
        <nav className="navbar__nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `navbar__link ${isActive ? "navbar__link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="navbar__user">
          <div className="navbar__avatar" aria-hidden="true" />
          <span className="navbar__user-name">User 1</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
}
