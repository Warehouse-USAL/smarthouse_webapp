import "../ZoneGrid/ZoneGrid.css";
import "./ZonePickerGrid.css";

// Variante seleccionable de ZoneGrid usada en la asignación de stock.
// A diferencia de ZoneGrid (que solo refleja ocupación), acá cada posición
// puede estar: seleccionable, seleccionada o deshabilitada. La pantalla
// decide la elegibilidad con `isSelectable(position)` y marca las elegidas
// pasando un Set de idPosition en `selectedIds`.

const sizeModifier = (size) => {
  switch (size) {
    case "PEQUEÑA": return "sm";
    case "GRANDE": return "lg";
    default: return "md";
  }
};

export default function ZonePickerGrid({ zone, selectedIds, isSelectable, onToggle }) {
  const colorKey = (zone.color || zone.zoneCode || "").toLowerCase();

  return (
    <div className={`zone-grid zone-grid--${colorKey}`}>
      <div className="zone-grid__title">
        <span className={`zone-grid__chip zone-grid__chip--${colorKey}`}>{zone.name}</span>
      </div>
      <div className="zone-grid__rows">
        {zone.lines.map((line) => (
          <div className="zone-grid__row" key={line.idLine}>
            <span className="zone-grid__row-label">
              Línea {String(line.numberLine).padStart(2, "0")}
            </span>
            <div className="zone-grid__cells">
              {line.positions.map((position) => {
                const selectable = isSelectable(position);
                const isSelected = selectedIds.has(position.idPosition);
                const sizeKey = sizeModifier(position.sizeStockToSave);
                const sizeTitle = position.sizeStockToSave || "—";
                const state = position.assignedProduct ? "occupied" : "empty";
                const disabled = !selectable && !isSelected;
                return (
                  <button
                    key={position.idPosition}
                    type="button"
                    disabled={disabled}
                    className={[
                      "zone-grid__cell",
                      `zone-grid__cell--${state}`,
                      `zone-grid__cell--size-${sizeKey}`,
                      disabled ? "zone-grid__cell--disabled" : "",
                      selectable && !isSelected ? "zone-picker__cell--selectable" : "",
                      isSelected ? "zone-picker__cell--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={`${zone.name} línea ${line.numberLine} posición ${position.positionName}`}
                    aria-pressed={isSelected}
                    title={`${position.positionName} · ${sizeTitle}${disabled ? " · no disponible" : ""}`}
                    onClick={() =>
                      onToggle?.({
                        idPosition: position.idPosition,
                        zoneName: zone.name,
                        lineNumber: line.numberLine,
                        positionName: position.positionName,
                        maximumCapacity: position.maximumCapacity ?? 0,
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
