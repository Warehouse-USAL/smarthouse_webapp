import { useState } from "react";
import "./Input.css";

import eyeOpen from "../../../assets/eye-open.svg";
import eyeClosed from "../../../assets/eye-closed.svg";

export default function Input({
  label,
  type = "text",
  placeholder,
  iconLeft,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";

  return (
    <div className="input-group">
      {label && <label>{label}</label>}

      <div className="input-wrapper">
        {iconLeft && <div className="icon-left">{iconLeft}</div>}

        <input
          type={
            isPassword
              ? showPassword
                ? "text"
                : "password"
              : type
          }
          placeholder={placeholder}
        />

        {isPassword && (
          <div
            className="icon-right"
            onClick={() => setShowPassword(!showPassword)}
          >
            <img
              src={showPassword ? eyeOpen : eyeClosed}
              alt="toggle password"
            />
          </div>
        )}
      </div>
    </div>
  );
}