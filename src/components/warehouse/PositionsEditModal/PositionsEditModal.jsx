import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./PositionsEditModal.css";

const SIZE_OPTIONS = [
  { value: "PEQUEÑA", label: "Pequeña" },
  { value: "MEDIANA", label: "Mediana" },
  { value: "GRANDE", label: "Grande" },
];

function PositionsEditBody({ onClose, onSaved, initialSelection }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idZone, setIdZone] = useState(initialSelection?.idZone || "");
  const [idLine, setIdLine] = useState(initialSelection?.idLine || "");
  const [idPosition, setIdPosition] = useState(initialSelection?.idPosition || "");
  // Override local del tamaño. Se resetea al cambiar la posición.
  const [sizeOverride, setSizeOverride] = useState(null);

  useEffect(() => {
    let cancelled = false;
    warehouseConfigService
      .get()
      .then((next) => {
        if (cancelled) return;
        setConfig(next);
        // Si vinimos desde un click en el mapa, respetamos esa selección;
        // si no, arrancamos en la primera zona.
        if (!initialSelection?.idZone) {
          setIdZone(next.zones[0]?.idZone || "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSelection]);

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

  const size = sizeOverride ?? selectedPosition?.sizeStockToSave ?? "MEDIANA";

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
    setIdPosition("");
    setSizeOverride(null);
  };

  const handleLineChange = (e) => {
    setIdLine(e.target.value);
    setIdPosition("");
    setSizeOverride(null);
  };

  const handlePositionChange = (e) => {
    setIdPosition(e.target.value);
    setSizeOverride(null);
  };

  const handleSave = async () => {
    if (!idZone || !idLine || !idPosition) return;
    setSaving(true);
    try {
      const next = await warehouseConfigService.updatePosition(idZone, idLine, idPosition, {
        sizeStockToSave: size,
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
        Seleccioná una zona, una línea y una posición para definir su tamaño.
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
        <Select
          label="Tamaño"
          value={size}
          onChange={(e) => setSizeOverride(e.target.value)}
          options={SIZE_OPTIONS}
          disabled={!idPosition}
        />
      </div>

      <div className="positions-edit__hint">
        El tamaño se define por posición: <strong>Pequeña</strong> acepta Cajas,{" "}
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

export default function PositionsEditModal({ open, onClose, onSaved, initialSelection }) {
  // Remontamos el body cuando cambia la posición de origen para reinicializar
  // los selects desde la selección del mapa.
  const bodyKey = initialSelection?.idPosition || "default";
  return (
    <Modal open={open} onClose={onClose} title="Modificar posiciones" size="lg">
      {open && (
        <PositionsEditBody
          key={bodyKey}
          onClose={onClose}
          onSaved={onSaved}
          initialSelection={initialSelection}
        />
      )}
    </Modal>
  );
}
