import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import PositionAssigner from "../PositionAssigner/PositionAssigner";
import { restockService } from "../../../services/restockService";
import { errorText } from "../../../lib/apiError";
import { STORAGE_UNIT_LABEL } from "../../../lib/storageCompatibility";
import "./LocateReceptionModal.css";

/*
| Segunda mitad del flujo que habilita feature/117-recepcion-sin-ubicacion: la
| mercadería ya entró al depósito (el remito está registrado y en
| PENDING_LOCATION) y ahora hay que decidir en qué posiciones va.
|
|   PATCH /restock/receptions/:id  { assignments: [{ position_id, quantity }] }
|
| Es incremental: se puede ubicar por partes. El backend pasa el remito a
| COMPLETED cuando lo ubicado alcanza lo recibido, e incrementa el stock de cada
| posición en el momento de asignarla.
*/

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "—");

export default function LocateReceptionModal({
  open,
  receptions = [],
  products = [],
  onClose,
  onLocated,
}) {
  const [receptionId, setReceptionId] = useState("");
  const [assignments, setAssignments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reinicio al abrir */
    setReceptionId(receptions[0]?.id ?? "");
    setAssignments({});
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, receptions]);

  const reception = useMemo(
    () => receptions.find((r) => r.id === receptionId) ?? null,
    [receptions, receptionId]
  );

  const product = useMemo(
    () => products.find((p) => p.id === reception?.productId) ?? null,
    [products, reception]
  );

  const pending = reception?.quantityPendingLocation ?? 0;

  const assignedTotal = useMemo(
    () => Object.values(assignments).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [assignments]
  );

  const canSubmit = !submitting && assignedTotal > 0 && assignedTotal <= pending;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await restockService.assignReceptionPositions(
        reception.id,
        Object.entries(assignments).map(([positionId, quantity]) => ({
          positionId,
          quantity,
        }))
      );
      onLocated?.();
      onClose?.();
    } catch (e) {
      setError(
        errorText(e, {
          ASSIGNMENT_QUANTITY_MISMATCH:
            "Estás asignando más unidades de las que quedan sin ubicar.",
          RECEPTION_ALREADY_COMPLETED: "Ese remito ya está completamente ubicado.",
          POSITION_ALREADY_OCCUPIED:
            "Alguna de las posiciones elegidas ya tiene otro producto.",
          STOCK_EXCEEDS_CAPACITY:
            "La cantidad asignada supera la capacidad de alguna posición.",
        }, "No se pudieron asignar las posiciones.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const options = receptions.map((r) => {
    const p = products.find((x) => x.id === r.productId);
    return {
      value: r.id,
      label: `${formatDate(r.createdAt)} · ${p?.name ?? r.productId} · ${
        r.quantityPendingLocation
      } sin ubicar`,
    };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ubicar mercadería recibida"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Asignando…" : "Asignar posiciones"}
          </Button>
        </>
      }
    >
      <p className="locate-modal__subtitle">
        Estos remitos ya se recibieron pero todavía tienen mercadería sin
        posición asignada. Al confirmar, el stock de las posiciones elegidas se
        incrementa.
      </p>

      {receptions.length === 0 ? (
        <p className="locate-modal__empty">
          No hay remitos pendientes de ubicación.
        </p>
      ) : (
        <div className="locate-modal__form">
          <Select
            label="Remito"
            value={receptionId}
            onChange={(e) => {
              setReceptionId(e.target.value);
              setAssignments({});
            }}
            options={options}
          />

          {reception && (
            <>
              <div className="locate-modal__info">
                <Badge variant="warning" dot>
                  Pendiente de ubicación
                </Badge>
                <span>
                  {product?.name ?? reception.productId} · Recibido:{" "}
                  <strong>{reception.quantityReceived}</strong> · Ya ubicado:{" "}
                  <strong>{reception.quantityLocated}</strong> · Falta ubicar:{" "}
                  <strong>{pending}</strong>
                </span>
              </div>

              <PositionAssigner
                productId={reception.productId}
                deliveryUnit={reception.deliveryUnit}
                quantity={pending}
                assignments={assignments}
                onChange={setAssignments}
                emptyHint={`No se pueden calcular posiciones para este remito (unidad de entrega ${
                  STORAGE_UNIT_LABEL[reception.deliveryUnit] ?? "desconocida"
                }).`}
              />

              <p className="locate-modal__hint">
                <Icon name="info" size={15} />
                Podés ubicar por partes: el remito queda pendiente hasta que se
                asignen las {pending} unidades.
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <StatusBanner
          statusBannerState="status-banner-error"
          icon={<Icon name="alert" size={16} />}
          text={error}
        />
      )}
    </Modal>
  );
}
