import "./ZoneGrid.css";

export default function ZoneGrid({ zone, selected, onSelect }) {
  const { id, name, lines, positions } = zone;
  const lineRange = Array.from({ length: lines }, (_, i) => i + 1);
  const positionRange = Array.from({ length: positions }, (_, i) => i + 1);

  return (
    <div className={`zone-grid zone-grid--${id.toLowerCase()}`}>
      <div className="zone-grid__title">
        <span className={`zone-grid__chip zone-grid__chip--${id.toLowerCase()}`}>{name}</span>
      </div>
      <div className="zone-grid__rows">
        {lineRange.map((line) => (
          <div className="zone-grid__row" key={line}>
            <span className="zone-grid__row-label">Línea {line}</span>
            <div className="zone-grid__cells">
              {positionRange.map((pos) => {
                const isSelected =
                  selected?.zone === id && Number(selected.line) === line && Number(selected.position) === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    className={`zone-grid__cell ${isSelected ? "zone-grid__cell--selected" : ""}`}
                    aria-label={`Zona ${id} línea ${line} posición ${pos}`}
                    onClick={() => onSelect?.({ zone: id, line, position: pos })}
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
