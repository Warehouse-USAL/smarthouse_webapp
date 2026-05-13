import { useState } from "react";
import "./Input.css";

import eyeOpen from "../../../assets/icons/eye-open.svg";
import eyeClosed from "../../../assets/icons/eye-closed.svg";

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  iconLeft,
  error,
  hint,
  id,
  name,
  required,
  min,
  step,
  disabled,
  ...rest
  iconLeft,
}) {
  const fieldId = id || name;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";

  return (
    <div className={`input-group ${error ? "input-group--error" : ""}`}>
      {label && (
        <label htmlFor={fieldId}>
          {label}
          {required && <span className="input-group__required"> *</span>}
        </label>
      )}
      <div className={`input-wrap ${iconLeft ? "input-wrap--has-icon" : ""}`}>
        {iconLeft && <span className="input-wrap__icon">{iconLeft}</span>}
        <input
          id={fieldId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={onChange}
          required={required}
          min={min}
          step={step}
          disabled={disabled}
          {...rest}
        />
      </div>
      {error ? (
        <span className="input-group__error">{error}</span>
      ) : hint ? (
        <span className="input-group__hint">{hint}</span>
      ) : null}
    </div>
  );
}
