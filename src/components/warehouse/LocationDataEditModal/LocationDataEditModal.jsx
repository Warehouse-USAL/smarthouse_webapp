import { useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Input from "../../ui/Input/Input";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LocationDataEditModal.css";

const buildOptions = (count, prefix) =>
  Array.from({ length: count || 0 }, (_, i) => ({
    value: String(i + 1),
    label: `${prefix} ${String(i + 1).padStart(2, "0")}`,
  }));

const loadCapacity = (zone, line, position, height) => {
  if (!zone || !line || !position || !height) return "";
  const data = warehouseConfigService.getLocationData(
    zone,
    Number(line),
    Number(position),
    Number(height)
  );
  return data?.capacity != null ? String(data.capacity) : "";
};

function LocationDataEditBody({ onClose, onSaved }) {
  const [config] = useState(() => warehouseConfigService.get());
  const [zoneId, setZoneId] = useState(config.zones[0]?.id || "");
  const [line, setLine] = useState("");
  const [position, setPosition] = useState("");
  const [height, setHeight] = useState("");
  const [capacity, setCapacity] = useState("");

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

  const positionConfig = useMemo(() => {
    if (!zoneId || !line || !position) return null;
    return warehouseConfigService.getPositionConfig(zoneId, Number(line), Number(position));
  }, [zoneId, line, position]);

  const heightOptions = useMemo(
    () => buildOptions(positionConfig?.height || 0, "Altura"),
    [positionConfig]
  );

  const code = warehouseConfigService.buildLocationCode({
    zone: zoneId,
    line,
    position,
    height,
  });

  const handleZoneChange = (e) => {
    setZoneId(e.target.value);
    setLine(""); setPosition(""); setHeight(""); setCapacity("");
  };
  const handleLineChange = (e) => {
    setLine(e.target.value);
    setPosition(""); setHeight(""); setCapacity("");
  };
  const handlePositionChange = (e) => {
    setPosition(e.target.value);
    setHeight(""); setCapacity("");
  };
  const handleHeightChange = (e) => {
    const v = e.target.value;
    setHeight(v);
    setCapacity(loadCapacity(zoneId, line, position, v));
  };

  const handleSave = () => {
    if (!zoneId || !line || !position || !height) return;
    warehouseConfigService.updateLocationData(
      zoneId,
      Number(line),
      Number(position),
      Number(height),
      { capacity: Math.max(0, Number(capacity) || 0) }
    );
    onSaved?.(warehouseConfigService.get());
    onClose?.();
  };

  return (
    <>
      <p className="location-data__subtitle">
        Seleccioná una ubicación exacta y actualizá su capacidad máxima.
      </p>

      <div className="location-data__fields">
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
          disabled={!line}
        />
        <Select
          label="Altura"
          value={height}
          onChange={handleHeightChange}
          options={heightOptions}
          placeholder="Seleccioná altura"
          disabled={!position}
        />
      </div>

      <div className="location-data__section">
        <span className="location-data__section-title">Datos de la ubicación</span>
        <Input
          name="capacity"
          label="Capacidad máxima en unidades"
          type="number"
          min={0}
          step={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          disabled={!height}
        />
      </div>

      {code && (
        <div className="location-data__code">
          <span className="location-data__code-label">Código de ubicación:</span>
          <span className="location-data__code-value">{code}</span>
        </div>
      )}

      <div className="location-data__actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!height}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

export default function LocationDataEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar datos de ubicación" size="lg">
      {open && <LocationDataEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
