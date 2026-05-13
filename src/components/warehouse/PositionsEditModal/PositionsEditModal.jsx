import { useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./PositionsEditModal.css";

const MAX_HEIGHT = 6;

const buildOptions = (count, prefix) =>
  Array.from({ length: count || 0 }, (_, i) => ({
    value: String(i + 1),
    label: `${prefix} ${String(i + 1).padStart(2, "0")}`,
  }));

function PositionsEditBody({ onClose, onSaved }) {
  const [config] = useState(() => warehouseConfigService.get());
  const initialZone = config.zones[0]?.id || "";
  const [zoneId, setZoneId] = useState(initialZone);
  const [line, setLine] = useState(initialZone ? "1" : "");
  const [position, setPosition] = useState(initialZone ? "1" : "");
  const [height, setHeight] = useState(() => {
    if (!initialZone) return 1;
    return warehouseConfigService.getPositionConfig(initialZone, 1, 1)?.height ?? 1;
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
    () => buildOptions(selectedZone?.lines || 0, "Línea"),
    [selectedZone]
  );

  const lineConfig = useMemo(() => {
    if (!zoneId || !line) return null;
    return warehouseConfigService.getLineConfig(zoneId, Number(line));
  }, [zoneId, line]);

  const positionOptions = useMemo(
    () => buildOptions(lineConfig?.positions || 0, "Posición"),
    [lineConfig]
  );

  const handleZoneChange = (e) => {
    const id = e.target.value;
    setZoneId(id);
    setLine("1");
    setPosition("1");
    setHeight(warehouseConfigService.getPositionConfig(id, 1, 1)?.height ?? 1);
  };

  const handleLineChange = (e) => {
    const v = e.target.value;
    setLine(v);
    setPosition("1");
    setHeight(warehouseConfigService.getPositionConfig(zoneId, Number(v), 1)?.height ?? 1);
  };

  const handlePositionChange = (e) => {
    const v = e.target.value;
    setPosition(v);
    setHeight(
      warehouseConfigService.getPositionConfig(zoneId, Number(line), Number(v))?.height ?? 1
    );
  };

  const decrement = () => setHeight((h) => Math.max(1, Number(h) - 1));
  const increment = () => setHeight((h) => Math.min(MAX_HEIGHT, Number(h) + 1));

  const handleSave = () => {
    warehouseConfigService.updatePosition(zoneId, Number(line), Number(position), {
      height: Number(height),
    });
    onSaved?.(warehouseConfigService.get());
    onClose?.();
  };

  const positionsForView = lineConfig?.positions || 0;
  const positionNum = Number(position);
  const windowStart = Math.max(1, Math.min(positionsForView - 8, positionNum - 4));
  const viewPositions = Array.from(
    { length: Math.min(9, positionsForView) },
    (_, i) => windowStart + i
  ).filter((p) => p <= positionsForView);

  const heightLevels = Array.from({ length: MAX_HEIGHT }, (_, i) => MAX_HEIGHT - i);
  const zoneColor = (selectedZone?.color || selectedZone?.id || "").toLowerCase();

  return (
    <>
      <p className="positions-edit__subtitle">
        Seleccioná una zona, una línea y una posición para cambiar su altura.
      </p>

      <div className="positions-edit__layout">
        <div className="positions-edit__form">
          <Select
            label="Zona"
            value={zoneId}
            onChange={handleZoneChange}
            options={zoneOptions}
            placeholder="Seleccioná zona"
          />
          <Select
            label="Línea"
            value={line}
            onChange={handleLineChange}
            options={lineOptions}
            placeholder="Seleccioná línea"
            disabled={!zoneId}
          />
          <Select
            label="Posición"
            value={position}
            onChange={handlePositionChange}
            options={positionOptions}
            placeholder="Seleccioná posición"
            disabled={!zoneId || !line}
          />

          <div className="positions-edit__stepper-field">
            <label>Altura</label>
            <div className="positions-edit__stepper">
              <button type="button" className="positions-edit__step-btn" onClick={decrement} aria-label="Disminuir altura">
                −
              </button>
              <span className="positions-edit__step-value">{height}</span>
              <button type="button" className="positions-edit__step-btn" onClick={increment} aria-label="Aumentar altura">
                +
              </button>
            </div>
            <span className="positions-edit__step-hint">Altura máxima: {MAX_HEIGHT} niveles</span>
          </div>
        </div>

        <div className="positions-edit__visual">
          <div className="positions-edit__visual-header">
            <span>Vista de la línea seleccionada</span>
            <span className="positions-edit__visual-meta">
              {line ? `Línea ${String(line).padStart(2, "0")}` : ""}
            </span>
          </div>

          <div className="positions-edit__strip">
            {viewPositions.map((p) => (
              <div
                key={p}
                className={`positions-edit__strip-cell positions-edit__strip-cell--${zoneColor} ${p === positionNum ? "positions-edit__strip-cell--active" : ""}`}
              >
                <span className="positions-edit__strip-num">{p}</span>
              </div>
            ))}
          </div>

          <div className="positions-edit__stack-label">Altura de la posición seleccionada</div>

          <div className="positions-edit__stack">
            <div className="positions-edit__stack-axis">
              {heightLevels.map((lvl) => (
                <span key={lvl} className="positions-edit__stack-axis-label">{lvl}</span>
              ))}
            </div>
            <div className="positions-edit__stack-bars">
              {heightLevels.map((lvl) => (
                <div
                  key={lvl}
                  className={`positions-edit__stack-bar ${lvl <= Number(height) ? `positions-edit__stack-bar--filled positions-edit__stack-bar--${zoneColor}` : ""}`}
                />
              ))}
              <span className="positions-edit__stack-base" />
            </div>
          </div>
        </div>
      </div>

      <div className="positions-edit__actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!zoneId || !line || !position}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

export default function PositionsEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar posiciones" size="lg">
      {open && <PositionsEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
