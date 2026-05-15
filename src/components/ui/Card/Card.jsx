import "./Card.css";

export default function Card({ children, padding = "md", className = "", as: As = "div", ...rest }) {
  return (
    <As className={`card card--p-${padding} ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ icon, title, action, className = "" }) {
  return (
    <div className={`card-header ${className}`}>
      <div className="card-header__title">
        {icon && <span className="card-header__icon">{icon}</span>}
        <h3>{title}</h3>
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </div>
  );
}
