import { useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./ZonesEditModal.css";

const LINE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

function ZonesEditBody({ onClose, onSaved }) {
  const [zones, setZones] = useState(() => warehouseConfigService.get().zones);

  const handleLinesChange = (zoneId) => (e) => {
    const lines = Number(e.target.value);
    setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, lines } : z)));
  };

  const handleAddZone = () => {
    const next = warehouseConfigService.addZone();
    setZones(next.zones);
  };

  const handleRemoveZone = (zoneId) => {
    setZones((zs) => zs.filter((z) => z.id !== zoneId));
  };

  const handleSave = () => {
    const current = warehouseConfigService.get();
    const currentIds = new Set(current.zones.map((z) => z.id));
    const nextIds = new Set(zones.map((z) => z.id));
    currentIds.forEach((id) => {
      if (!nextIds.has(id)) warehouseConfigService.removeZone(id);
    });
    zones.forEach((z) =>
      warehouseConfigService.updateZone(z.id, { lines: z.lines, name: z.name })
    );
    onSaved?.(warehouseConfigService.get());
    onClose?.();
  };

  return (
    <>
      <p className="zones-edit__subtitle">
        Definí la cantidad de líneas que tendrá cada zona del warehouse.
      </p>

      <div className="zones-edit__list">
        {zones.map((zone) => (
          <div
            className={`zones-edit__row zones-edit__row--${(zone.color || zone.id || "").toLowerCase()}`}
            key={zone.id}
          >
            <div className="zones-edit__zone-label">
              <span className={`zones-edit__dot zones-edit__dot--${(zone.color || zone.id || "").toLowerCase()}`} />
              <span>{zone.name}</span>
            </div>
            <div className="zones-edit__field">
              <label htmlFor={`zone-${zone.id}-lines`}>Cantidad de líneas</label>
              <Select
                id={`zone-${zone.id}-lines`}
                value={String(zone.lines)}
                onChange={handleLinesChange(zone.id)}
                options={LINE_OPTIONS}
              />
            </div>
            <button
              type="button"
              className="zones-edit__remove"
              onClick={() => handleRemoveZone(zone.id)}
              aria-label={`Eliminar ${zone.name}`}
              disabled={zones.length <= 1}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}

        <button type="button" className="zones-edit__add" onClick={handleAddZone}>
          <span className="zones-edit__add-icon">
            <Icon name="plus" size={18} />
          </span>
          <span>Agregar zona</span>
        </button>
      </div>

      <div className="zones-edit__actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

export default function ZonesEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar zonas" size="lg">
      {open && <ZonesEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
