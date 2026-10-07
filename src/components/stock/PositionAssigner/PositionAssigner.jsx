import { useEffect, useMemo, useState } from "react";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import Spinner from "../../ui/Spinner/Spinner";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import { STORAGE_UNIT_LABEL } from "../../../lib/storageCompatibility";
import "./PositionAssigner.css";

/*
| Reparto de una cantidad entre posiciones del warehouse. Lo usan los dos
| momentos en que hay que ubicar mercadería:
|
|   · al registrar el remito (RemitoModal)
|   · al ubicar después un remito que quedó PENDING_LOCATION (LocateReceptionModal)
|
| Las posiciones candidatas las decide el backend en
| GET /warehouse/positions/available: filtra por posición activa, tamaño igual a
| la unidad de entrega y producto nulo o igual, y devuelve cuántas unidades
| entran en cada una por capacidad y por volumen.
|
| `assignments` es { [positionId]: cantidad } y lo maneja el componente padre,
| que es quien arma el payload.
*/

export default function PositionAssigner({
  productId,
  deliveryUnit,
  quantity,
  assignments,
  onChange,
  emptyHint = "Completá producto, cantidad y unidad de entrega para ver las posiciones compatibles.",
}) {
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);

  const ready = Boolean(productId) && Boolean(deliveryUnit) && quantity > 0;

  useEffect(() => {
    if (!ready) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia la lista mientras falten datos
      setAvailable([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Un respiro mientras se tipea la cantidad.
    const timer = setTimeout(() => {
      warehouseConfigService
        .getAvailablePositions({ productId, deliveryUnit, quantity })
        .then((rows) => {
          if (cancelled) return;
          setAvailable(rows);
          // Un reparto previo puede apuntar a posiciones que ya no califican.
          const valid = new Set(rows.map((r) => r.positionId));
          const filtered = Object.fromEntries(
            Object.entries(assignments).filter(([id]) => valid.has(id))
          );
          if (Object.keys(filtered).length !== Object.keys(assignments).length) {
            onChange(filtered);
          }
        })
        .catch(() => {
          if (!cancelled) setAvailable([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // assignments/onChange quedan fuera a propósito: solo se refetchea cuando
    // cambian producto, unidad o cantidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, productId, deliveryUnit, quantity]);

  const assignedTotal = useMemo(
    () => Object.values(assignments).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [assignments]
  );

  const remaining = quantity - assignedTotal;

  const setAssignment = (positionId, value, max) => {
    const n = Math.max(0, Math.min(Number(value) || 0, max));
    const next = { ...assignments };
    if (n <= 0) delete next[positionId];
    else next[positionId] = n;
    onChange(next);
  };

  const togglePosition = (position) => {
    if (assignments[position.positionId]) {
      const next = { ...assignments };
      delete next[position.positionId];
      onChange(next);
      return;
    }
    const free = Math.max(0, quantity - assignedTotal);
    const take = Math.min(free, position.availableUnits);
    if (take <= 0) return;
    onChange({ ...assignments, [position.positionId]: take });
  };

  // Reparte de la posición más grande a la más chica, igual que ordena el
  // backend la respuesta de /available.
  const autoDistribute = () => {
    let left = quantity;
    const next = {};
    for (const position of available) {
      if (left <= 0) break;
      const take = Math.min(left, position.availableUnits);
      if (take > 0) {
        next[position.positionId] = take;
        left -= take;
      }
    }
    onChange(next);
  };

  if (!ready) return <p className="position-assigner__placeholder">{emptyHint}</p>;

  if (loading) return <Spinner size={20} label="Buscando posiciones compatibles…" />;

  if (available.length === 0) {
    return (
      <p className="position-assigner__placeholder">
        No hay posiciones libres del tamaño{" "}
        <strong>{STORAGE_UNIT_LABEL[deliveryUnit] ?? deliveryUnit}</strong> con
        lugar para este producto.
      </p>
    );
  }

  return (
    <>
      <div className="position-assigner__bar">
        <span
          className={`position-assigner__count ${
            remaining === 0 ? "position-assigner__count--ok" : ""
          }`}
        >
          <Icon name={remaining === 0 ? "check" : "alert"} size={16} />
          Asignado {assignedTotal} de {quantity} unidades
          {remaining > 0 ? ` · faltan ${remaining}` : ""}
          {remaining < 0 ? ` · sobran ${Math.abs(remaining)}` : ""}
        </span>
        <Button variant="secondary" size="sm" onClick={autoDistribute}>
          Repartir automáticamente
        </Button>
      </div>

      <div className="position-assigner__grid">
        {available.map((position) => {
          const assigned = assignments[position.positionId] ?? 0;
          return (
            <div
              key={position.positionId}
              className={`position-assigner__card ${
                assigned > 0 ? "position-assigner__card--on" : ""
              }`}
            >
              <label className="position-assigner__head">
                <input
                  type="checkbox"
                  className="position-assigner__check"
                  checked={assigned > 0}
                  onChange={() => togglePosition(position)}
                />
                <span className="position-assigner__name">
                  {position.positionName}
                </span>
              </label>
              <span className="position-assigner__spaces">
                {position.availableUnits} espacios libres
              </span>
              <input
                type="number"
                className="position-assigner__qty"
                min={0}
                max={position.availableUnits}
                value={assigned || ""}
                placeholder="0"
                onChange={(e) =>
                  setAssignment(
                    position.positionId,
                    e.target.value,
                    position.availableUnits
                  )
                }
                aria-label={`Unidades en ${position.positionName}`}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
