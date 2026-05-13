import "./Spinner.css";

export default function Spinner({ size = 24, label }) {
  return (
    <div className="spinner-wrap" role="status">
      <span
        className="spinner"
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
      />
      {label && <span className="spinner-wrap__label">{label}</span>}
    </div>
  );
}
