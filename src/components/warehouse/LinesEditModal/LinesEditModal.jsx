import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Input from "../../ui/Input/Input";
import Checkbox from "../../ui/Checkbox/Checkbox";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LinesEditModal.css";

function LinesEditBody({ onClose, onSaved }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idZone, setIdZone] = useState("");
  const [idLine, setIdLine] = useState("");
  // Overrides locales. Se resetean cuando cambia la línea seleccionada.
  const [override, setOverride] = useState({ maxAllowedPositions: null, isActive: null });

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

  const maxAllowedPositions =
    override.maxAllowedPositions ?? selectedLine?.maxAllowedPositions ?? 0;
  const isActive = override.isActive ?? selectedLine?.isActive ?? false;

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
    setOverride({ maxAllowedPositions: null, isActive: null });
  };

  const handleLineChange = (e) => {
    setIdLine(e.target.value);
    setOverride({ maxAllowedPositions: null, isActive: null });
  };

  const handleAddLine = async () => {
    if (!idZone) return;
    const next = await warehouseConfigService.addLine(idZone);
    setConfig(next);
    const zone = warehouseConfigService.findZone(next, idZone);
    const lastLine = zone?.lines[zone.lines.length - 1];
    if (lastLine) setIdLine(lastLine.idLine);
    setOverride({ maxAllowedPositions: null, isActive: null });
  };

  const handleRemoveLine = async () => {
    if (!idZone || !idLine) return;
    const next = await warehouseConfigService.removeLine(idZone, idLine);
    setConfig(next);
    setIdLine("");
    setOverride({ maxAllowedPositions: null, isActive: null });
  };

  const handleSave = async () => {
    if (!idZone || !idLine) return;
    setSaving(true);
    try {
      const next = await warehouseConfigService.updateLine(idZone, idLine, {
        maxAllowedPositions: Math.max(1, Number(maxAllowedPositions) || 1),
        isActive,
      });
      setConfig(next);
      onSaved?.(next);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const zoneColor = (selectedZone?.color || selectedZone?.zoneCode || "").toLowerCase();
  const previewCount = Math.max(0, Number(maxAllowedPositions) || 0);
  const previewCells = Array.from({ length: previewCount }, (_, i) => i + 1);

  if (loading) {
    return <p className="lines-edit__subtitle">Cargando líneas…</p>;
  }

  return (
    <>
      <p className="lines-edit__subtitle">
        Seleccioná una zona y una línea para configurar sus posiciones.
      </p>

      <div className="lines-edit__zone-field">
        <Select
          label="Zona"
          value={idZone}
          onChange={handleZoneChange}
          options={zoneOptions}
          placeholder="Seleccioná zona"
        />
      </div>

      <div className="lines-edit__line-row">
        <Select
          label="Línea"
          value={idLine}
          onChange={handleLineChange}
          options={lineOptions}
          placeholder="Seleccioná línea"
          disabled={!idZone}
        />
        <div className="lines-edit__line-actions">
          <Button variant="secondary" type="button" onClick={handleAddLine} disabled={!idZone}>
            <Icon name="plus" size={14} /> Agregar línea
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handleRemoveLine}
            disabled={!idLine || (selectedZone?.lines?.length ?? 0) <= 1}
          >
            <Icon name="trash" size={14} /> Eliminar
          </Button>
        </div>
      </div>

      <div className="lines-edit__row">
        <Input
          name="maxAllowedPositions"
          label="Posiciones permitidas"
          type="number"
          min={1}
          step={1}
          value={maxAllowedPositions}
          onChange={(e) =>
            setOverride((o) => ({ ...o, maxAllowedPositions: e.target.value }))
          }
          disabled={!idLine}
        />
        <div className="lines-edit__active">
          <Checkbox
            name="line-active"
            label="Línea activa"
            checked={isActive}
            onChange={(e) =>
              setOverride((o) => ({ ...o, isActive: e.target.checked }))
            }
            disabled={!idLine}
          />
        </div>
      </div>

      {idLine && (
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
        <span>
          Cambiar la cantidad de posiciones agrega o recorta posiciones al final de la línea.
        </span>
      </div>

      <div className="lines-edit__actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!idLine || saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
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
