import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Input from "../../ui/Input/Input";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LocationDataEditModal.css";

function LocationDataEditBody({ onClose, onSaved }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idZone, setIdZone] = useState("");
  const [idLine, setIdLine] = useState("");
  const [idPosition, setIdPosition] = useState("");
  // Override local sobre la capacidad de la posición seleccionada.
  // Se resetea al cambiar la posición.
  const [capacityOverride, setCapacityOverride] = useState(null);

  useEffect(() => {
    let cancelled = false;
    warehouseConfigService
      .get()
      .then((next) => {
        if (cancelled) return;
        setConfig(next);
        setIdZone(next.zones[0]?.idZone || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedZone = useMemo(
    () => warehouseConfigService.findZone(config, idZone),
    [config, idZone]
  );
  const selectedLine = useMemo(
    () => warehouseConfigService.findLine(selectedZone, idLine),
    [selectedZone, idLine]
  );
  const selectedPosition = useMemo(
    () => warehouseConfigService.findPosition(selectedLine, idPosition),
    [selectedLine, idPosition]
  );

  const zoneOptions = useMemo(
    () => config.zones.map((z) => ({ value: z.idZone, label: z.name })),
    [config]
  );
  const lineOptions = useMemo(
    () =>
      (selectedZone?.lines || []).map((l) => ({
        value: l.idLine,
        label: `Línea ${String(l.numberLine).padStart(2, "0")}`,
      })),
    [selectedZone]
  );
  const positionOptions = useMemo(
    () =>
      (selectedLine?.positions || []).map((p) => ({
        value: p.idPosition,
        label: p.positionName,
      })),
    [selectedLine]
  );

  const capacity =
    capacityOverride ??
    (selectedPosition?.maximumCapacity != null
      ? String(selectedPosition.maximumCapacity)
      : "");

  const code = warehouseConfigService.buildLocationCode({
    zoneCode: selectedZone?.zoneCode,
    numberLine: selectedLine?.numberLine,
    positionName: selectedPosition?.positionName,
  });

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
    setIdPosition("");
    setCapacityOverride(null);
  };
  const handleLineChange = (e) => {
    setIdLine(e.target.value);
    setIdPosition("");
    setCapacityOverride(null);
  };
  const handlePositionChange = (e) => {
    setIdPosition(e.target.value);
    setCapacityOverride(null);
  };

  const handleSave = async () => {
    if (!idZone || !idLine || !idPosition) return;
    setSaving(true);
    try {
      const next = await warehouseConfigService.updatePosition(idZone, idLine, idPosition, {
        maximumCapacity: Math.max(0, Number(capacity) || 0),
      });
      setConfig(next);
      onSaved?.(next);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="location-data__subtitle">Cargando ubicaciones…</p>;
  }

  return (
    <>
      <p className="location-data__subtitle">
        Seleccioná una ubicación y actualizá su capacidad máxima.
      </p>

      <div className="location-data__fields">
        <Select
          label="Zona"
          value={idZone}
          onChange={handleZoneChange}
          options={zoneOptions}
          placeholder="Seleccioná zona"
        />
        <Select
          label="Línea"
          value={idLine}
          onChange={handleLineChange}
          options={lineOptions}
          placeholder="Seleccioná línea"
          disabled={!idZone}
        />
        <Select
          label="Posición"
          value={idPosition}
          onChange={handlePositionChange}
          options={positionOptions}
          placeholder="Seleccioná posición"
          disabled={!idLine}
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
          onChange={(e) => setCapacityOverride(e.target.value)}
          disabled={!idPosition}
        />
      </div>

      {code && (
        <div className="location-data__code">
          <span className="location-data__code-label">Código de ubicación:</span>
          <span className="location-data__code-value">{code}</span>
        </div>
      )}

      <div className="location-data__actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!idPosition || saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
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
