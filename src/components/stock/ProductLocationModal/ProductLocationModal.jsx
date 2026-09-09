import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import { restockService } from "../../../services/restockService";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
import "./ProductLocationModal.css";

const UNIT_OPTIONS = [
  { value: "CAJA", label: "Caja" },
  { value: "MEDIO_PALLET", label: "Medio pallet" },
  { value: "PALLET", label: "Pallet" },
];

const EMPTY = { quantity: "", unit: "", selectedLocation: "" };

export default function ProductLocationModal({ open, onClose, onAssigned, product }) {
  const [values, setValues] = useState(EMPTY);
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
      setPositions([]);
      setPositionsError(null);
      setError(null);
    }
  }, [open]);

  // Carga las posiciones disponibles para la unidad seleccionada. La cantidad
  // se filtra en el cliente (available_units >= cantidad) para evitar refetch
  // en cada tecla del input de cantidad; al endpoint va la mínima solicitada.
  useEffect(() => {
    // setPositions* de forma síncrona mantiene la UI coherente al cambiar de
    // unidad; es intencional, no el cascade derivado de render.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open || !product || !values.unit) {
      setPositions([]);
      setPositionsError(null);
      return undefined;
    }

    let cancelled = false;
    setPositionsLoading(true);
    setPositionsError(null);
    restockService
      .getAvailablePositions({
        productId: product.id,
        deliveryUnit: values.unit,
        quantity: 1,
      })
      .then((list) => {
        if (!cancelled) setPositions(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setPositions([]);
        setPositionsError(
          err?.response?.data?.error?.message ||
            "No pudimos consultar las ubicaciones disponibles."
        );
      })
      .finally(() => {
        if (!cancelled) setPositionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, product, values.unit]);

  if (!product) return null;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const quantity = Number(values.quantity);
  const visiblePositions = positions.filter((p) => p.availableUnits >= quantity);
  const selectedPosition = positions.find(
    (p) => p.positionId === values.selectedLocation
  );
  const selectedValid =
    selectedPosition && selectedPosition.availableUnits >= quantity;

  const canSubmit =
    Number.isFinite(quantity) &&
    quantity >= 1 &&
    !!values.unit &&
    !!values.selectedLocation &&
    !!selectedValid &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await warehouseConfigService.assignProductToPosition(
        values.selectedLocation,
        { id: product.id, sku: product.sku, name: product.name },
        quantity
      );
      onAssigned?.();
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          "No pudimos asignar la ubicación. Probá con otra."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const stock = product.availableStock ?? product.stockAvailable ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar ubicación"
      size="lg"
      footer={
        <div className="product-location-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            iconLeft={<Icon name="pin" size={16} />}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "Asignando…" : "Confirmar asignación"}
          </Button>
        </div>
      }
    >
      <p className="product-location-modal__subtitle">
        Completá la información y seleccioná una ubicación disponible para este producto.
      </p>

      <div className="product-location-modal__form">
        {/* ── Sección 1: Producto ──────────────────────────── */}
        <section className="product-location-modal__section">
          <h4 className="product-location-modal__section-title">
            <span className="product-location-modal__section-num">1</span>
            Producto
          </h4>
          <div className="product-location-modal__product-card">
            <div className="product-location-modal__product-thumb">
              {product.imageUrl ? (
                <img
                  className="product-location-modal__product-thumb-img"
                  src={product.imageUrl}
                  alt={product.name}
                />
              ) : (
                <Icon name="box" size={32} />
              )}
            </div>
            <div className="product-location-modal__product-info">
              <span className="product-location-modal__product-tag">Producto</span>
              <span className="product-location-modal__product-name">{product.name}</span>
              <span className="product-location-modal__product-sku">SKU: {product.sku}</span>
              <span className="product-location-modal__product-meta">
                <Icon name="box" size={14} />
                Stock: {stock} unidades
              </span>
              <Badge variant="danger" dot>Sin ubicación</Badge>
            </div>
          </div>
        </section>

        {/* ── Sección 2: Cantidad y unidad ─────────────────── */}
        <div className="product-location-modal__row">
          <section className="product-location-modal__section">
            <h4 className="product-location-modal__section-title">
              <span className="product-location-modal__section-num">2</span>
              Cantidad a asignar
            </h4>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Ej. 50"
              hint="Unidades"
              value={values.quantity}
              onChange={set("quantity")}
              required
            />
          </section>

          <section className="product-location-modal__section">
            <h4 className="product-location-modal__section-title">
              <span className="product-location-modal__section-num">3</span>
              Tipo de unidad
            </h4>
            <Select
              options={UNIT_OPTIONS}
              placeholder="Seleccioná una unidad"
              value={values.unit}
              onChange={set("unit")}
              required
            />
            <span className="product-location-modal__field-hint">
              Ej. Pallet, Medio Pallet, Caja
            </span>
          </section>
        </div>

        {/* ── Sección 4: Ubicaciones disponibles ───────────── */}
        <section className="product-location-modal__section">
          <h4 className="product-location-modal__section-title">
            <span className="product-location-modal__section-num">4</span>
            Ubicaciones disponibles
          </h4>
          <p className="product-location-modal__section-hint">
            Seleccioná una ubicación con capacidad suficiente para la cantidad solicitada.
          </p>

          <div className="product-location-modal__info-box">
            <Icon name="info" size={20} color="var(--color-info-blue)" />
            <p>
              Se muestran solo ubicaciones con espacio suficiente para la cantidad solicitada.
            </p>
          </div>

          {positionsError && (
            <p className="product-location-modal__locations-error">{positionsError}</p>
          )}

          {!values.unit ? (
            <p className="product-location-modal__locations-empty">
              Seleccioná una unidad para ver las ubicaciones disponibles.
            </p>
          ) : positionsLoading ? (
            <p className="product-location-modal__locations-empty">
              Cargando ubicaciones…
            </p>
          ) : visiblePositions.length === 0 ? (
            <p className="product-location-modal__locations-empty">
              No hay ubicaciones disponibles para este producto con esa unidad y cantidad.
            </p>
          ) : (
            <div className="product-location-modal__locations-grid">
              {visiblePositions.map((position) => (
                <button
                  type="button"
                  key={position.positionId}
                  className={`product-location-modal__location-card ${
                    values.selectedLocation === position.positionId
                      ? "product-location-modal__location-card--selected"
                      : ""
                  }`}
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      selectedLocation: position.positionId,
                    }))
                  }
                >
                  <span className="product-location-modal__location-name">
                    {position.positionName}
                  </span>
                  <span className="product-location-modal__location-spaces">
                    {position.availableUnits} unidades disponibles
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {error && <p className="product-location-modal__error">{error}</p>}
    </Modal>
  );
}