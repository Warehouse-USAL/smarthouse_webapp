import "./Input.css";

export default function Input({
  label,
  type = "text",
  placeholder,
  iconLeft,
}) {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}

      <div className="input-wrapper">
        {iconLeft && <div className="icon-left">{iconLeft}</div>}

        <input
          type={type}
          placeholder={placeholder}
          className={iconLeft ? "with-left-icon" : ""}
        />
      </div>
    </div>
  );
}