import "./Badge.css";

export default function Badge({ children, variant = "neutral", dot = false }) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
