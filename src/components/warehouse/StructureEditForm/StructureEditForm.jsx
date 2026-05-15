import { useState } from "react";
import Input from "../../ui/Input/Input";
import Button from "../../ui/Button/Button";
import "./StructureEditForm.css";

const clamp = (value, min, max) => {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};

export default function StructureEditForm({ zones, fields = ["lines", "positions", "heights"], onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() =>
    zones.reduce((acc, z) => {
      acc[z.id] = { lines: z.lines, positions: z.positions, heights: z.heights };
      return acc;
    }, {})
  );

  const handleChange = (zoneId, field) => (e) => {
    setDraft((d) => ({
      ...d,
      [zoneId]: { ...d[zoneId], [field]: clamp(e.target.value, 1, 50) },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(draft);
  };

  const labels = { lines: "Líneas", positions: "Posiciones", heights: "Alturas" };

  return (
    <form className="structure-edit-form" onSubmit={handleSubmit}>
      <div className="structure-edit-form__head">
        <div />
        {fields.map((f) => (
          <span className="structure-edit-form__col-label" key={f}>{labels[f]}</span>
        ))}
      </div>
      {zones.map((zone) => (
        <div className="structure-edit-form__row" key={zone.id}>
          <span className="structure-edit-form__zone">{zone.name}</span>
          {fields.map((field) => (
            <Input
              key={field}
              type="number"
              min={1}
              step={1}
              value={draft[zone.id][field]}
              onChange={handleChange(zone.id, field)}
            />
          ))}
        </div>
      ))}
      <div className="structure-edit-form__actions">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}
