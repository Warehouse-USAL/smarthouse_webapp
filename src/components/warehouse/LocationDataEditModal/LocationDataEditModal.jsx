import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LocationDataEditModal.css";

// El tamaño se edita por posición desde PositionsEditModal, así que este modal
// quedó como vista de consulta del código de ubicación. Si en el futuro no
// suma información extra, conviene eliminarlo junto con su botón en la página.
function LocationDataEditBody({ onClose }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [idZone, setIdZone] = useState("");
  const [idLine, setIdLine] = useState("");
  const [idPosition, setIdPosition] = useState("");

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

  const code = warehouseConfigService.buildLocationCode({
    zoneCode: selectedZone?.zoneCode,
    numberLine: selectedLine?.numberLine,
    positionName: selectedPosition?.positionName,
  });

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
    setIdPosition("");
  };
  const handleLineChange = (e) => {
    setIdLine(e.target.value);
    setIdPosition("");
  };
  const handlePositionChange = (e) => {
    setIdPosition(e.target.value);
  };

  if (loading) {
    return <p className="location-data__subtitle">Cargando ubicaciones…</p>;
  }

  return (
    <>
      <p className="location-data__subtitle">
        Seleccioná una ubicación para ver su código.
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

      {code && (
        <div className="location-data__code">
          <span className="location-data__code-label">Código de ubicación:</span>
          <span className="location-data__code-value">{code}</span>
        </div>
      )}

      <div className="location-data__actions">
        <Button type="button" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </>
  );
}

export default function LocationDataEditModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Datos de ubicación" size="lg">
      {open && <LocationDataEditBody onClose={onClose} />}
    </Modal>
  );
}
