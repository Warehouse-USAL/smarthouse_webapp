import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Select from "../../ui/Select/Select";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import { SIZE_TO_UNIT, STORAGE_UNIT_LABEL } from "../../../lib/storageCompatibility";
import "./PositionsEditModal.css";

const SIZE_OPTIONS = [
  { value: "PEQUEÑA", label: "Pequeña" },
  { value: "MEDIANA", label: "Mediana" },
  { value: "GRANDE", label: "Grande" },
];

const draftFromPosition = (p) => ({
  idPosition: p.idPosition,
  positionName: p.positionName,
  sizeStockToSave: p.sizeStockToSave,
  isActive: p.isActive ?? true,
  occupied: !!p.assignedProduct,
  // Valores originales para detectar cambios.
  _size: p.sizeStockToSave,
  _active: p.isActive ?? true,
});

// Editor de tamaños/estado por línea: se eligen zona y línea, y se editan TODAS
// sus posiciones de una sola vez. Reemplaza el viejo flujo de-a-una con dropdowns
// en cascada.
function PositionsEditBody({ onClose, onSaved, initialSelection }) {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [idZone, setIdZone] = useState(initialSelection?.idZone || "");
  const [idLine, setIdLine] = useState(initialSelection?.idLine || "");

  useEffect(() => {
    let cancelled = false;
    warehouseConfigService
      .get()
      .then((next) => {
        if (cancelled) return;
        setConfig(next);
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

  const handleZoneChange = (e) => {
    setIdZone(e.target.value);
    setIdLine("");
  };

  if (loading) {
    return <p className="positions-edit__subtitle">Cargando posiciones…</p>;
  }

  return (
    <>
      <p className="positions-edit__subtitle">
        Elegí una línea y ajustá el tamaño y el estado de cada posición. El tamaño
        define qué unidad de almacenamiento acepta. Los cambios se aplican al guardar.
      </p>

      <div className="positions-edit__pickers">
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
          onChange={(e) => setIdLine(e.target.value)}
          options={lineOptions}
          placeholder="Seleccioná línea"
          disabled={!idZone}
        />
      </div>

      {!idLine ? (
        <div className="positions-edit__placeholder">
          Seleccioná una línea para ver sus posiciones.
        </div>
      ) : (
        // key por línea: reinicia los borradores al cambiar de línea sin usar
        // un efecto que sincronice estado.
        <LinePositionsTable
          key={idLine}
          idZone={idZone}
          idLine={idLine}
          positions={selectedLine?.positions || []}
          onSaved={onSaved}
          onClose={onClose}
        />
      )}

      {!idLine && (
        <div className="positions-edit__actions">
          <span className="positions-edit__changed-count">Sin cambios</span>
          <div className="positions-edit__actions-buttons">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function LinePositionsTable({ idZone, idLine, positions, onSaved, onClose }) {
  const [drafts, setDrafts] = useState(() => positions.map(draftFromPosition));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const changed = drafts.filter(
    (d) => d.sizeStockToSave !== d._size || d.isActive !== d._active
  );

  const updateDraft = (idPosition, patch) => {
    setDrafts((list) => list.map((d) => (d.idPosition === idPosition ? { ...d, ...patch } : d)));
  };

  const applySizeToAll = (size) => {
    setDrafts((list) => list.map((d) => ({ ...d, sizeStockToSave: size })));
  };

  const handleSave = async () => {
    if (changed.length === 0) {
      onClose?.();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const d of changed) {
        await warehouseConfigService.updatePosition(idZone, idLine, d.idPosition, {
          sizeStockToSave: d.sizeStockToSave,
          isActive: d.isActive,
        });
      }
      const fresh = await warehouseConfigService.get();
      onSaved?.(fresh);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "No pudimos guardar algunos cambios.");
    } finally {
      setSaving(false);
    }
  };

  if (drafts.length === 0) {
    return (
      <>
        <div className="positions-edit__placeholder">
          Esta línea no tiene posiciones. Agregalas desde “Líneas”.
        </div>
        <div className="positions-edit__actions">
          <span className="positions-edit__changed-count">Sin cambios</span>
          <div className="positions-edit__actions-buttons">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="positions-edit__bulk">
        <span className="positions-edit__bulk-label">Aplicar a todas:</span>
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="positions-edit__bulk-btn"
            onClick={() => applySizeToAll(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="positions-edit__table" role="table">
        <div className="positions-edit__head" role="row">
          <span role="columnheader">Posición</span>
          <span role="columnheader">Tamaño</span>
          <span role="columnheader">Acepta</span>
          <span role="columnheader">Estado</span>
        </div>
        <div className="positions-edit__rows">
          {drafts.map((d) => {
            const rowChanged = d.sizeStockToSave !== d._size || d.isActive !== d._active;
            return (
              <div
                className={`positions-edit__row ${rowChanged ? "positions-edit__row--changed" : ""}`}
                role="row"
                key={d.idPosition}
              >
                <span className="positions-edit__name" role="cell">
                  {d.positionName}
                  {d.occupied && (
                    <span className="positions-edit__badge" title="Posición ocupada">
                      Ocupada
                    </span>
                  )}
                </span>
                <span role="cell">
                  <Select
                    value={d.sizeStockToSave}
                    onChange={(e) => updateDraft(d.idPosition, { sizeStockToSave: e.target.value })}
                    options={SIZE_OPTIONS}
                  />
                </span>
                <span className="positions-edit__unit" role="cell">
                  {STORAGE_UNIT_LABEL[SIZE_TO_UNIT[d.sizeStockToSave]]}
                </span>
                <span role="cell">
                  <Select
                    value={d.isActive ? "true" : "false"}
                    onChange={(e) => updateDraft(d.idPosition, { isActive: e.target.value === "true" })}
                    options={[
                      { value: "true", label: "Activa" },
                      { value: "false", label: "Inactiva" },
                    ]}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="positions-edit__error">{error}</p>}

      <div className="positions-edit__actions">
        <span className="positions-edit__changed-count">
          {changed.length > 0
            ? `${changed.length} ${changed.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}`
            : "Sin cambios"}
        </span>
        <div className="positions-edit__actions-buttons">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || changed.length === 0}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function PositionsEditModal({ open, onClose, onSaved, initialSelection }) {
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
