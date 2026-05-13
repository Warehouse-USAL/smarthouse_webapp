import { useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Input from "../../ui/Input/Input";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LinesEditModal.css";

const buildLineOptions = (count) =>
  Array.from({ length: count || 0 }, (_, i) => ({
    value: String(i + 1),
    label: `Línea ${String(i + 1).padStart(2, "0")}`,
  }));

function LinesEditBody({ onClose, onSaved }) {
  const [config] = useState(() => warehouseConfigService.get());
  const initialZone = config.zones[0]?.id || "";
  const [zoneId, setZoneId] = useState(initialZone);
  const [line, setLine] = useState(initialZone ? "1" : "");
  const [positions, setPositions] = useState(() => {
    if (!initialZone) return 0;
    return warehouseConfigService.getLineConfig(initialZone, 1)?.positions ?? 0;
  });

  const zoneOptions = useMemo(
    () => config.zones.map((z) => ({ value: z.id, label: z.name })),
    [config]
  );

  const selectedZone = useMemo(
    () => config.zones.find((z) => z.id === zoneId),
    [config, zoneId]
  );

  const lineOptions = useMemo(
    () => buildLineOptions(selectedZone?.lines || 0),
    [selectedZone]
  );

  const handleZoneChange = (e) => {
    const id = e.target.value;
    setZoneId(id);
    setLine("1");
    setPositions(warehouseConfigService.getLineConfig(id, 1)?.positions ?? 0);
  };

  const handleLineChange = (e) => {
    const value = e.target.value;
    setLine(value);
    setPositions(warehouseConfigService.getLineConfig(zoneId, Number(value))?.positions ?? 0);
  };

  const handleSave = () => {
    warehouseConfigService.updateLine(zoneId, Number(line), {
      positions: Math.max(1, Number(positions) || 1),
    });
    onSaved?.(warehouseConfigService.get());
    onClose?.();
  };

  const previewCells = Array.from({ length: Math.max(0, Number(positions) || 0) }, (_, i) => i + 1);
  const zoneColor = (selectedZone?.color || selectedZone?.id || "").toLowerCase();

  return (
    <>
      <p className="lines-edit__subtitle">
        Seleccioná una zona y una línea para editar sus configuraciones.
      </p>

      <div className="lines-edit__zone-field">
        <Select
          label="Zona"
          value={zoneId}
          onChange={handleZoneChange}
          options={zoneOptions}
          placeholder="Seleccioná zona"
        />
      </div>

      <div className="lines-edit__row">
        <Select
          label="Línea"
          value={line}
          onChange={handleLineChange}
          options={lineOptions}
          placeholder="Seleccioná línea"
          disabled={!zoneId}
        />
        <Input
          name="positions"
          label="Cantidad de posiciones"
          type="number"
          min={1}
          step={1}
          value={positions}
          onChange={(e) => setPositions(e.target.value)}
          disabled={!zoneId}
        />
      </div>

      {zoneId && (
        <div className="lines-edit__preview">
          <span className="lines-edit__preview-label">Vista previa de la línea seleccionada</span>
          <div className={`lines-edit__cells lines-edit__cells--${zoneColor}`}>
            {previewCells.map((p) => (
              <span
                key={p}
                className={`lines-edit__cell ${p === previewCells.length ? "lines-edit__cell--last" : ""}`}
              >
                {p === previewCells.length ? p : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="lines-edit__hint">
        <Icon name="info" size={16} />
        <span>Estas configuraciones se aplicarán a todas las posiciones de la línea seleccionada.</span>
      </div>

      <div className="lines-edit__actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!zoneId || !line}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

export default function LinesEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar líneas" size="lg">
      {open && <LinesEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
