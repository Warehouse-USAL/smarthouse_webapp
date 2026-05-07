import "./Button.css";

export default function Button({
  children,
  variant = "primary",
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