import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Input from "../../ui/Input/Input";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import { computeZoneStats } from "../../../lib/warehouseStats";
import "./ZonesEditModal.css";

const DEFAULT_MAX_LINES = 4;

// Próximo código libre (A, B, C…). Además de lo que hay en pantalla, evita los
// códigos de zonas soft-deleted (reserved): el backend mantiene zone_code único
// incluso para zonas borradas, así que reasignar "A" tras borrarla daría 409.
const nextCode = (drafts, reserved = []) => {
  const used = new Set([
    ...drafts.map((d) => (d.zoneCode || "").toUpperCase()),
    ...reserved.map((c) => (c || "").toUpperCase()),
  ]);
  for (let c = 65; c <= 90; c += 1) {
    const ch = String.fromCharCode(c);
    if (!used.has(ch)) return ch;
  }
  return `Z${drafts.length + reserved.length + 1}`;
};

const draftFromZone = (zone) => ({
  key: zone.idZone,
  idZone: zone.idZone,
  zoneCode: zone.zoneCode,
  color: zone.color,
  maxAllowedLines: zone.maxAllowedLines,
  isNew: false,
  stats: computeZoneStats(zone),
});

// Modelo de borrador: agregar, editar y eliminar se acumulan localmente y nada
// impacta al backend hasta "Guardar cambios". Así el modal es predecible:
// Cancelar descarta todo.
function ZonesEditBody({ onClose, onSaved }) {
  const [drafts, setDrafts] = useState([]);
  const [originalIds, setOriginalIds] = useState([]);
  const [reservedCodes, setReservedCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tempId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      warehouseConfigService.get(),
      warehouseConfigService.getReservedZoneCodes(),
    ])
      .then(([config, reserved]) => {
        if (cancelled) return;
        setDrafts(config.zones.map(draftFromZone));
        setOriginalIds(config.zones.map((z) => z.idZone));
        setReservedCodes(reserved);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (key, patch) => {
    setDrafts((list) => list.map((z) => (z.key === key ? { ...z, ...patch } : z)));
  };

  const handleAddZone = () => {
    tempId.current += 1;
    setDrafts((list) => [
      ...list,
      {
        key: `new-${tempId.current}`,
        idZone: null,
        zoneCode: nextCode(list, reservedCodes),
        maxAllowedLines: DEFAULT_MAX_LINES,
        isNew: true,
        stats: null,
      },
    ]);
  };

  const handleRemoveZone = (key) => {
    setDrafts((list) => list.filter((z) => z.key !== key));
  };

  const pending = useMemo(() => {
    const draftById = new Map(drafts.filter((d) => d.idZone).map((d) => [d.idZone, d]));
    const created = drafts.filter((d) => d.isNew).length;
    const removed = originalIds.filter((id) => !draftById.has(id)).length;
    // No tenemos el snapshot original de cada campo, así que para el contador
    // tratamos created + removed como los cambios "fuertes". Las ediciones de
    // campos se guardan igual; el contador es solo orientativo.
    return { created, removed, total: created + removed };
  }, [drafts, originalIds]);

  const validate = () => {
    const codes = drafts.map((d) => (d.zoneCode || "").trim().toUpperCase());
    if (codes.some((c) => !c)) return "Todas las zonas necesitan un código.";
    const dup = codes.find((c, i) => codes.indexOf(c) !== i);
    if (dup) return `El código “${dup}” está repetido.`;
    // Una zona nueva no puede reusar el código de una zona borrada: el backend
    // mantiene zone_code único incluso para soft-deletes y respondería 409.
    const reserved = new Set(reservedCodes.map((c) => (c || "").toUpperCase()));
    const taken = drafts.find(
      (d) => d.isNew && reserved.has((d.zoneCode || "").trim().toUpperCase())
    );
    if (taken) {
      const code = (taken.zoneCode || "").trim().toUpperCase();
      return `El código “${code}” pertenece a una zona eliminada y no se puede reutilizar.`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const draftIds = new Set(drafts.filter((d) => d.idZone).map((d) => d.idZone));

      // 1) Eliminar zonas que ya no están.
      for (const id of originalIds) {
        if (!draftIds.has(id)) await warehouseConfigService.removeZone(id);
      }
      // 2) Actualizar existentes.
      for (const d of drafts.filter((z) => !z.isNew)) {
        await warehouseConfigService.updateZone(d.idZone, {
          zoneCode: (d.zoneCode || "").trim().toUpperCase(),
          maxAllowedLines: Math.max(1, Number(d.maxAllowedLines) || 1),
        });
      }
      // 3) Crear nuevas.
      for (const d of drafts.filter((z) => z.isNew)) {
        await warehouseConfigService.addZone({
          zoneCode: (d.zoneCode || "").trim().toUpperCase(),
          maxAllowedLines: Math.max(1, Number(d.maxAllowedLines) || 1),
        });
      }

      const fresh = await warehouseConfigService.get();
      onSaved?.(fresh);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "No pudimos guardar algunas zonas.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="zones-edit__subtitle">Cargando zonas…</p>;
  }

  return (
    <>
      <p className="zones-edit__subtitle">
        Una zona agrupa líneas de almacenamiento y se identifica por su código
        (A, B, C…). Definí cuántas líneas puede tener como máximo. Los cambios se
        aplican al guardar.
      </p>

      <div className="zones-edit__list">
        {drafts.map((zone) => {
          const code = (zone.zoneCode || "").toUpperCase();
          const colorKey = (zone.color || code.charAt(0) || "a").toLowerCase();
          return (
            <div className="zones-edit__row" key={zone.key}>
              <div className="zones-edit__zone-label">
                <span className={`zones-edit__dot zones-edit__dot--${colorKey}`} />
                <div>
                  <span className="zones-edit__zone-name">Zona {code || "—"}</span>
                  <span className="zones-edit__zone-meta">
                    {zone.isNew
                      ? "Nueva"
                      : `${zone.stats.lines} ${zone.stats.lines === 1 ? "línea" : "líneas"} · ${zone.stats.positions} ${zone.stats.positions === 1 ? "posición" : "posiciones"}`}
                  </span>
                </div>
              </div>

              <div className="zones-edit__fields">
                <Input
                  name={`zone-${zone.key}-code`}
                  label="Código"
                  value={zone.zoneCode}
                  maxLength={3}
                  onChange={(e) => updateDraft(zone.key, { zoneCode: e.target.value.toUpperCase() })}
                />
                <Input
                  name={`zone-${zone.key}-lines`}
                  label="Líneas máx."
                  type="number"
                  min={1}
                  step={1}
                  value={zone.maxAllowedLines}
                  onChange={(e) => updateDraft(zone.key, { maxAllowedLines: e.target.value })}
                />
              </div>

              <button
                type="button"
                className="zones-edit__remove"
                onClick={() => handleRemoveZone(zone.key)}
                aria-label={`Eliminar zona ${code}`}
                disabled={drafts.length <= 1}
                title={drafts.length <= 1 ? "Debe quedar al menos una zona" : "Eliminar zona"}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          );
        })}

        <button type="button" className="zones-edit__add" onClick={handleAddZone}>
          <span className="zones-edit__add-icon">
            <Icon name="plus" size={18} />
          </span>
          <span>Agregar zona</span>
        </button>
      </div>

      {pending.removed > 0 && (
        <p className="zones-edit__warning">
          <Icon name="alert" size={15} />
          <span>
            Vas a eliminar {pending.removed} {pending.removed === 1 ? "zona" : "zonas"} con todas
            sus líneas y posiciones. Esta acción no se puede deshacer.
          </span>
        </p>
      )}

      {error && <p className="zones-edit__error">{error}</p>}

      <div className="zones-edit__actions">
        <span className="zones-edit__count">
          {pending.total > 0
            ? `${pending.created ? `${pending.created} a crear` : ""}${pending.created && pending.removed ? " · " : ""}${pending.removed ? `${pending.removed} a eliminar` : ""}`
            : "Editá los códigos o el tope de líneas"}
        </span>
        <div className="zones-edit__actions-buttons">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function ZonesEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Zonas" size="lg">
      {open && <ZonesEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
