import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Input from "../../ui/Input/Input";
import Icon from "../../ui/Icon/Icon";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./ZonesEditModal.css";

const draftFrom = (zone) => ({
  idZone: zone.idZone,
  zoneCode: zone.zoneCode,
  name: zone.name,
  color: zone.color,
  maxAllowedLines: zone.maxAllowedLines,
});

// name y color son derivados (no se persisten): name = `Zona ${zoneCode}`,
// color = hash estable del idZone → 1 de 4 paletas (a/b/c/d).
// El tamaño ya no vive en la zona: se edita por posición desde PositionsEditModal.

function ZonesEditBody({ onClose, onSaved }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    warehouseConfigService
      .get()
      .then((config) => {
        if (!cancelled) setDrafts(config.zones.map(draftFrom));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (idZone, patch) => {
    setDrafts((list) => list.map((z) => (z.idZone === idZone ? { ...z, ...patch } : z)));
  };

  const handleAddZone = async () => {
    const next = await warehouseConfigService.addZone();
    setDrafts(next.zones.map(draftFrom));
  };

  const handleRemoveZone = (idZone) => {
    setDrafts((list) => list.filter((z) => z.idZone !== idZone));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const current = await warehouseConfigService.get();
      const currentIds = new Set(current.zones.map((z) => z.idZone));
      const nextIds = new Set(drafts.map((z) => z.idZone));

      const removals = [...currentIds]
        .filter((id) => !nextIds.has(id))
        .map((id) => warehouseConfigService.removeZone(id));
      await Promise.all(removals);

      for (const d of drafts) {
        await warehouseConfigService.updateZone(d.idZone, {
          zoneCode: d.zoneCode,
          maxAllowedLines: Math.max(1, Number(d.maxAllowedLines) || 1),
        });
      }

      const fresh = await warehouseConfigService.get();
      onSaved?.(fresh);
      onClose?.();
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
        Editá los datos de cada zona del warehouse.
      </p>

      <div className="zones-edit__list">
        {drafts.map((zone) => {
          const colorKey = (zone.color || zone.zoneCode || "").toLowerCase();
          return (
            <div className={`zones-edit__row zones-edit__row--${colorKey}`} key={zone.idZone}>
              <div className="zones-edit__zone-label">
                <span className={`zones-edit__dot zones-edit__dot--${colorKey}`} />
                <span>{zone.name}</span>
              </div>

              <div className="zones-edit__fields">
                <Input
                  name={`zone-${zone.idZone}-code`}
                  label="Código"
                  value={zone.zoneCode}
                  onChange={(e) => updateDraft(zone.idZone, { zoneCode: e.target.value })}
                />
                <Input
                  name={`zone-${zone.idZone}-lines`}
                  label="Líneas permitidas"
                  type="number"
                  min={1}
                  step={1}
                  value={zone.maxAllowedLines}
                  onChange={(e) => updateDraft(zone.idZone, { maxAllowedLines: e.target.value })}
                />
              </div>

              <button
                type="button"
                className="zones-edit__remove"
                onClick={() => handleRemoveZone(zone.idZone)}
                aria-label={`Eliminar ${zone.name}`}
                disabled={drafts.length <= 1}
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

      <div className="zones-edit__actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </>
  );
}

export default function ZonesEditModal({ open, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Modificar zonas" size="lg">
      {open && <ZonesEditBody onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
