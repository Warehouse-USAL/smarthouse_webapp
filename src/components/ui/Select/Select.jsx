import "./Select.css";

export default function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  name,
  id,
  required,
  disabled,
  error,
}) {
  const fieldId = id || name;
  return (
    <div className={`select-group ${error ? "select-group--error" : ""}`}>
      {label && (
        <label htmlFor={fieldId}>
          {label}
          {required && <span className="select-group__required"> *</span>}
        </label>
      )}
      <div className="select-wrap">
        <select
          id={fieldId}
          name={name}
          value={value ?? ""}
          onChange={onChange}
          required={required}
          disabled={disabled}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const optValue = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
        <svg
          className="select-wrap__chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {error && <span className="select-group__error">{error}</span>}
    </div>
  );
}
