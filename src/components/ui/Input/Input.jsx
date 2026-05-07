import "./Input.css";

export default function Input({
  label,
  type = "text",
  placeholder,
}) {
  return (
    <div className="input-group">
      <label>{label}</label>

      <input
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
}