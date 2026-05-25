import "./ZoneGrid.css";

const positionState = (position) => {
  if (!position.isActive) return "inactive";
  if (!position.assignedProduct) return "empty";
  return "occupied";
};

const sizeModifier = (size) => {
  switch (size) {
    case "PEQUEÑA": return "sm";
    case "GRANDE": return "lg";
    default: return "md";
  }
};

export default function ZoneGrid({ zone, selected, onSelect }) {
  const colorKey = (zone.color || zone.zoneCode || "").toLowerCase();
  // El tamaño se define a nivel de zona, no de posición.
  const sizeKey = sizeModifier(zone.sizeStockToSave);
  const sizeTitle = zone.sizeStockToSave || "—";

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
    case "inactive": return "Inactiva";
    case "empty": return "Vacía";
    case "occupied": return "Ocupada";
    default: return "";
  }
};
