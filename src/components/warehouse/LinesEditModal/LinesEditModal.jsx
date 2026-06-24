import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import Input from "../../ui/Input/Input";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./LinesEditModal.css";

const DEFAULT_POSITIONS = 12;

const draftFromLine = (line) => {
  const positions = line.positions || [];
  const occupied = positions.filter((p) => p.assignedProduct).length;
  return {
    key: line.idLine,
    idLine: line.idLine,
    numberLine: line.numberLine,
    maxAllowedPositions: line.maxAllowedPositions || positions.length,
    isNew: false,
    currentPositions: positions.length,
    occupied,
    _positions: line.maxAllowedPositions || positions.length,
  };
};

// Se elige una zona y se editan TODAS sus líneas en borrador; nada impacta al
// backend hasta "Guardar". La cantidad de posiciones crea o recorta posiciones
// al final de la línea.
function LinesEditBody({ onClose, onSaved }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [idZone, setIdZone] = useState("");

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

  const zoneOptions = useMemo(
    () => config.zones.map((z) => ({ value: z.idZone, label: z.name })),
    [config]
  );

  if (loading) {
    return <p className="lines-edit__subtitle">Cargando líneas…</p>;
  }

  return (
    <>
      <p className="lines-edit__subtitle">
        Una línea es una fila de posiciones dentro de una zona. La cantidad de
        posiciones agrega o recorta posiciones al final de la línea. Los cambios
        se aplican al guardar.
      </p>

      <div className="lines-edit__zone-field">
        <Select
          label="Zona"
          value={idZone}
          onChange={(e) => setIdZone(e.target.value)}
          options={zoneOptions}
          placeholder="Seleccioná zona"
        />
        {selectedZone?.maxAllowedLines > 0 && (
          <span className="lines-edit__limit">
            {selectedZone.lines.length}/{selectedZone.maxAllowedLines} líneas
          </span>
        )}
      </div>

      {selectedZone ? (
        // key por zona: reinicia los borradores al cambiar de zona.
        <ZoneLinesEditor
          key={idZone}
          idZone={idZone}
          zone={selectedZone}
          onSaved={onSaved}
          onClose={onClose}
        />
      ) : (
        <div className="lines-edit__placeholder">No hay zonas disponibles.</div>
      )}
    </>
  );
}

function ZoneLinesEditor({ idZone, zone, onSaved, onClose }) {
  const [drafts, setDrafts] = useState(() => (zone.lines || []).map(draftFromLine));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tempId = useRef(0);

  const originalIds = useMemo(() => (zone.lines || []).map((l) => l.idLine), [zone]);

  const maxAllowedLines = zone.maxAllowedLines ?? 0;
  const atLineLimit = maxAllowedLines > 0 && drafts.length >= maxAllowedLines;

  const updateDraft = (key, patch) => {
    setDrafts((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleAddLine = () => {
    if (atLineLimit) return;
    tempId.current += 1;
    setDrafts((list) => [
      ...list,
      {
        key: `new-${tempId.current}`,
        idLine: null,
        numberLine: null,
        maxAllowedPositions: DEFAULT_POSITIONS,
        isNew: true,
        currentPositions: 0,
        occupied: 0,
        _positions: 0,
      },
    ]);
  };

  const handleRemoveLine = (key) => {
    setDrafts((list) => list.filter((l) => l.key !== key));
  };

  const pending = useMemo(() => {
    const draftIds = new Set(drafts.filter((d) => d.idLine).map((d) => d.idLine));
    const created = drafts.filter((d) => d.isNew).length;
    const removed = originalIds.filter((id) => !draftIds.has(id)).length;
    const resized = drafts.filter(
      (d) => !d.isNew && Number(d.maxAllowedPositions) !== d._positions
    ).length;
    return { created, removed, resized, total: created + removed + resized };
  }, [drafts, originalIds]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const draftIds = new Set(drafts.filter((d) => d.idLine).map((d) => d.idLine));

      // 1) Eliminar líneas que ya no están.
      for (const id of originalIds) {
        if (!draftIds.has(id)) await warehouseConfigService.removeLine(idZone, id);
      }
      // 2) Redimensionar existentes que cambiaron.
      for (const d of drafts.filter((l) => !l.isNew && Number(l.maxAllowedPositions) !== l._positions)) {
        await warehouseConfigService.updateLine(idZone, d.idLine, {
          maxAllowedPositions: Math.max(1, Number(d.maxAllowedPositions) || 1),
        });
      }
      // 3) Crear nuevas con su cantidad de posiciones.
      for (const d of drafts.filter((l) => l.isNew)) {
        await warehouseConfigService.addLine(idZone, {
          maxAllowedPositions: Math.max(1, Number(d.maxAllowedPositions) || 1),
        });
      }

      const fresh = await warehouseConfigService.get();
      onSaved?.(fresh);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "No pudimos guardar algunas líneas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {drafts.length === 0 ? (
        <div className="lines-edit__empty">
          <p className="lines-edit__placeholder">
            Esta zona todavía no tiene líneas. Agregá la primera.
          </p>
          <button
            type="button"
            className="lines-edit__add"
            onClick={handleAddLine}
            disabled={atLineLimit}
            title={atLineLimit ? "Llegaste al máximo de líneas de la zona" : "Agregar línea"}
          >
            <span className="lines-edit__add-icon">
              <Icon name="plus" size={18} />
            </span>
            <span>Agregar línea</span>
          </button>
        </div>
      ) : (
        <div className="lines-edit__list">
          {drafts.map((line) => {
            const resized = !line.isNew && Number(line.maxAllowedPositions) !== line._positions;
            return (
              <div
                className={`lines-edit__row ${resized ? "lines-edit__row--changed" : ""}`}
                key={line.key}
              >
                <div className="lines-edit__line-label">
                  <span className="lines-edit__line-name">
                    {line.isNew
                      ? "Línea nueva"
                      : `Línea ${String(line.numberLine).padStart(2, "0")}`}
                  </span>
                  <span className="lines-edit__line-meta">
                    {line.isNew
                      ? "Se creará al guardar"
                      : `${line.currentPositions} ${line.currentPositions === 1 ? "posición" : "posiciones"} · ${line.occupied} ${line.occupied === 1 ? "ocupada" : "ocupadas"}`}
                  </span>
                </div>

                <Input
                  name={`line-${line.key}-positions`}
                  label="Posiciones"
                  type="number"
                  min={1}
                  step={1}
                  value={line.maxAllowedPositions}
                  onChange={(e) => updateDraft(line.key, { maxAllowedPositions: e.target.value })}
                />

                <button
                  type="button"
                  className="lines-edit__remove"
                  onClick={() => handleRemoveLine(line.key)}
                  aria-label="Eliminar línea"
                  disabled={drafts.length <= 1}
                  title={drafts.length <= 1 ? "Debe quedar al menos una línea" : "Eliminar línea"}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className="lines-edit__add"
            onClick={handleAddLine}
            disabled={atLineLimit}
            title={atLineLimit ? "Llegaste al máximo de líneas de la zona" : "Agregar línea"}
          >
            <span className="lines-edit__add-icon">
              <Icon name="plus" size={18} />
            </span>
            <span>{atLineLimit ? "Máximo de líneas alcanzado" : "Agregar línea"}</span>
          </button>
        </div>
      )}

      {(pending.removed > 0 || pending.resized > 0) && (
        <p className="lines-edit__warning">
          <Icon name="alert" size={15} />
          <span>
            {pending.removed > 0 &&
              `Vas a eliminar ${pending.removed} ${pending.removed === 1 ? "línea" : "líneas"} con sus posiciones. `}
            {pending.resized > 0 &&
              "Reducir posiciones elimina las del final de la línea; si tienen producto asignado puede fallar."}
          </span>
        </p>
      )}

      {error && <p className="lines-edit__error">{error}</p>}

      <div className="lines-edit__actions">
        <span className="lines-edit__count">
          {pending.total > 0
            ? [
                pending.created && `${pending.created} a crear`,
                pending.removed && `${pending.removed} a eliminar`,
                pending.resized && `${pending.resized} a redimensionar`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Sin cambios"}
        </span>
        <div className="lines-edit__actions-buttons">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || pending.total === 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LinesEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Líneas" size="lg">
      {open && <LinesEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
