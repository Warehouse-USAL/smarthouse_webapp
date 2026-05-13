import "./StatusBanner.css";

export default function StatusBanner({
  icon,
  text,
  statusBannerState = "status-banner",
}) {
  return (
    <div className={statusBannerState}>
      <div className="status-banner-icon">
        {icon}
      </div>

      <span className="status-banner-text">
        {text}
      </span>
    </div>
  );
}