import "./ProgressBar.css";

export default function ProgressBar({ value = 0, variant }) {
  const v = Math.max(0, Math.min(100, value));
  const computedVariant = variant || (v >= 60 ? "success" : v >= 30 ? "warning" : "danger");
  return (
    <div className="progress" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress__bar progress__bar--${computedVariant}`} style={{ width: `${v}%` }} />
    </div>
  );
}
