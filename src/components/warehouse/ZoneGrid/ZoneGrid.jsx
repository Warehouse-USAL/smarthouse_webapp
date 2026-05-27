import "./ZoneGrid.css";

const positionState = (position) =>
  position.assignedProduct ? "occupied" : "empty";

const sizeModifier = (size) => {
  switch (size) {
    case "PEQUEÑA": return "sm";
    case "GRANDE": return "lg";
    default: return "md";
  }
};

export default function ZoneGrid({ zone, selected, onSelect }) {
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
                const isSelected =
                  selected?.idZone === zone.idZone &&
                  selected?.idLine === line.idLine &&
                  selected?.idPosition === position.idPosition;
                const state = positionState(position);
                // Cada posición tiene su propio tamaño.
                const sizeKey = sizeModifier(position.sizeStockToSave);
                const sizeTitle = position.sizeStockToSave || "—";
                return (
                  <button
                    key={position.idPosition}
                    type="button"
                    className={`zone-grid__cell zone-grid__cell--${state} zone-grid__cell--size-${sizeKey} ${isSelected ? "zone-grid__cell--selected" : ""}`}
                    aria-label={`${zone.name} línea ${line.numberLine} posición ${position.positionName}`}
                    title={`${position.positionName} · ${sizeTitle} · ${stateLabel(state)}`}
                    onClick={() =>
                      onSelect?.({
                        idZone: zone.idZone,
                        idLine: line.idLine,
                        idPosition: position.idPosition,
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

const stateLabel = (state) => {
  switch (state) {
    case "empty": return "Vacía";
    case "occupied": return "Ocupada";
    default: return "";
  }
};
