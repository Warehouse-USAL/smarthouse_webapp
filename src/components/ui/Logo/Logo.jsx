import "./Logo.css";

export default function Logo({ size = "md" }) {
  return (
    <div className={`logo logo--${size}`}>
      <svg
        viewBox="0 0 40 40"
        className="logo__mark"
        aria-hidden="true"
      >
        <polygon points="20,3 36,12 36,28 20,37 4,28 4,12" fill="#1f2937" />
        <polygon points="20,8 31,14.5 31,25.5 20,32 9,25.5 9,14.5" fill="#ffc400" />
        <polygon points="20,12 27,16 27,24 20,28 13,24 13,16" fill="#1f2937" />
      </svg>
      <span className="logo__text">SmartWarehouse</span>
    </div>
  );
}
