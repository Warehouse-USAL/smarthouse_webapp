import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../../ui/Logo/Logo";
import { logout } from "../../../services/authService";
import "./Navbar.css";

const NAV_ITEMS = [
  { to: "/inicio", label: "Inicio" },
  { to: "/configuracion", label: "Configuración del warehouse" },
  { to: "/productos", label: "Productos" },
  { to: "/asignacion-stock", label: "Asignación de stock" },
  { to: "/vehiculos", label: "Vehículos" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/login");
  }

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
        <div className="navbar__user-wrapper" ref={menuRef}>
          <button
            type="button"
            className="navbar__user"
            onClick={() => setOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="navbar__avatar" aria-hidden="true" />
            <span className="navbar__user-name">User 1</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`navbar__caret ${open ? "navbar__caret--open" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <div className="navbar__dropdown" role="menu">
              <button
                type="button"
                className="navbar__dropdown-item"
                onClick={handleLogout}
                role="menuitem"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
