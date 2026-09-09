import { useEffect, useRef, useState } from "react";
import Icon from "../Icon/Icon";
import "./DateRangeFilter.css";

// value / onChange manejan un rango { from, to } en formato ISO (yyyy-mm-dd),
// que es el que usan los <input type="date"> del popover.
const toDisplay = (iso) => (iso ? iso.split("-").reverse().join("/") : "…");

export default function DateRangeFilter({
  label,
  value = { from: "", to: "" },
  onChange,
  placeholder = "Todas las fechas",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasRange = Boolean(value.from || value.to);
  const text = hasRange
    ? `${toDisplay(value.from)} - ${toDisplay(value.to)}`
    : placeholder;

  return (
    <div className="date-range" ref={wrapRef}>
      {label && <span className="date-range__label">{label}</span>}
      <button
        type="button"
        className="date-range__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="calendar" size={16} className="date-range__icon" />
        <span className={`date-range__value ${hasRange ? "" : "date-range__value--empty"}`}>
          {text}
        </span>
        <Icon name="chevronDown" size={16} className="date-range__caret" />
      </button>

      {open && (
        <div className="date-range__popover" role="dialog">
          <label className="date-range__field">
            Desde
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </label>
          <label className="date-range__field">
            Hasta
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="date-range__clear"
            onClick={() => onChange({ from: "", to: "" })}
            disabled={!hasRange}
          >
            Limpiar fechas
          </button>
        </div>
      )}
    </div>
  );
}
