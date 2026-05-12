import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
}) {
  return (
    <button
      className={`button button--${variant}`}
      type={type}
    >
      {children}
    </button>
  );
}