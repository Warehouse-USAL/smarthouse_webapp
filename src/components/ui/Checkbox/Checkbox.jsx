import "./Checkbox.css";

export default function Checkbox({ label, checked, onChange, name, id, disabled }) {
  const fieldId = id || name;
  return (
    <label className="checkbox" htmlFor={fieldId}>
      <input
        id={fieldId}
        name={name}
        type="checkbox"
        checked={!!checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {label && <span className="checkbox__label">{label}</span>}
    </label>
  );
}
