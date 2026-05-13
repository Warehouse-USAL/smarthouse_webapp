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

  variant = "",

  ...rest
}) {

  const fieldId = id || name;

  const [showPassword, setShowPassword] =
    useState(false);

  const isPassword =
    type === "password";

  return (
    <div
      className={`
        input-group
        ${variant ? `input-group--${variant}` : ""}
        ${error ? "input-group--error" : ""}
      `}
    >

      {label && (
        <label htmlFor={fieldId}>

          {label}

          {required && (
            <span className="input-group__required">
              {" "}*
            </span>
          )}

        </label>
      )}

      <div
        className={`
          input-wrapper
          ${iconLeft ? "input-wrapper--has-icon" : ""}
        `}
      >

        {iconLeft && (
          <div className="icon-left">
            {iconLeft}
          </div>
        )}

        <input
          id={fieldId}

          name={name}

          value={value ?? ""}
          onChange={onChange}

          type={
            isPassword
              ? showPassword
                ? "text"
                : "password"
              : type
          }

          placeholder={placeholder}

          required={required}
          min={min}
          step={step}

          disabled={disabled}

          {...rest}
        />

        {isPassword && (
          <div
            className="icon-right"
            onClick={() =>
              setShowPassword(
                !showPassword
              )
            }
          >
            <img
              src={
                showPassword
                  ? eyeOpen
                  : eyeClosed
              }
              alt="toggle password"
            />
          </div>
        )}

      </div>

      {error ? (

        <span className="input-group__error">
          {error}
        </span>

      ) : hint ? (

        <span className="input-group__hint">
          {hint}
        </span>

      ) : null}

    </div>
  );
}