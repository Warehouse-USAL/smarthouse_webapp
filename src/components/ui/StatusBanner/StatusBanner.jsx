import "./StatusBanner.css";

export default function StatusBanner({
  icon,
  text,
}) {
  return (
    <div className="status-banner">
      <div className="status-banner-icon">
        {icon}
      </div>

      <span className="status-banner-text">
        {text}
      </span>
    </div>
  );
}