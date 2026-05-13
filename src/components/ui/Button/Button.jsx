import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  onClick,
}) {
  return (
    <button
      className={`button button--${variant}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}