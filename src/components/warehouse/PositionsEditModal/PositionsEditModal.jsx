import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Checkbox from "../../ui/Checkbox/Checkbox";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./PositionsEditModal.css";

const SIZE_LABEL = {
  PEQUEÑA: "Pequeña",
  MEDIANA: "Mediana",
  GRANDE: "Grande",
};

function PositionsEditBody({ onClose, onSaved }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idZone, setIdZone] = useState("");
  const [idLine, setIdLine] = useState("");
  const [idPosition, setIdPosition] = useState("");
  // Override local de isActive. Se resetea al cambiar la posición.
  const [activeOverride, setActiveOverride] = useState(null);

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

  const zoneSize = selectedZone?.sizeStockToSave ?? "MEDIANA";
  const isActive = activeOverride ?? selectedPosition?.isActive ?? false;

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
    setIdPosition("");
    setActiveOverride(null);
  };

  const handleLineChange = (e) => {
    setIdLine(e.target.value);
    setIdPosition("");
    setActiveOverride(null);
  };

  const handlePositionChange = (e) => {
    setIdPosition(e.target.value);
    setActiveOverride(null);
  };

  const handleSave = async () => {
    if (!idZone || !idLine || !idPosition) return;
    setSaving(true);
    try {
      const next = await warehouseConfigService.updatePosition(idZone, idLine, idPosition, {
        isActive,
      });
      setConfig(next);
      onSaved?.(next);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="positions-edit__subtitle">Cargando posiciones…</p>;
  }

  return (
    <>
      <p className="positions-edit__subtitle">
        Seleccioná una zona, una línea y una posición para definir su estado.
      </p>

      <div className="positions-edit__form positions-edit__form--full">
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
        <div className="positions-edit__info">
          <span className="positions-edit__info-label">Tamaño de zona</span>
          <span className="positions-edit__info-value">{SIZE_LABEL[zoneSize] || zoneSize}</span>
        </div>
        <div className="positions-edit__active-row">
          <Checkbox
            name="position-active"
            label="Posición activa"
            checked={isActive}
            onChange={(e) => setActiveOverride(e.target.checked)}
            disabled={!idPosition}
          />
        </div>
      </div>

      <div className="positions-edit__hint">
        El tamaño lo define la zona: <strong>Pequeña</strong> acepta Cajas,{" "}
        <strong>Mediana</strong> Medio Pallets y <strong>Grande</strong> Pallets.
      </div>

      <div className="positions-edit__actions">
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

export default function PositionsEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar posiciones" size="lg">
      {open && <PositionsEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
