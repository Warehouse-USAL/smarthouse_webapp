import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import "./ProductLocationModal.css";

const UNIT_OPTIONS = [
  { value: "pallet", label: "Pallet" },
  { value: "medio-pallet", label: "Medio pallet" },
  { value: "caja", label: "Caja" },
];

const AVAILABLE_LOCATIONS = [
  { location: "A-02-01", spaces: 50 },
  { location: "B-01-01", spaces: 50 },
  { location: "B-02-03", spaces: 50 },
];

const EMPTY = { quantity: "", unit: "", selectedLocation: "" };

export default function ProductLocationModal({ open, onClose, product }) {
  const [values, setValues] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
    }
  }, [open]);

  if (!product) return null;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

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
          <Button iconLeft={<Icon name="pin" size={16} />}>
            Confirmar asignación
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
              <Icon name="box" size={32} />
            </div>
            <div className="product-location-modal__product-info">
              <span className="product-location-modal__product-tag">Producto</span>
              <span className="product-location-modal__product-name">{product.name}</span>
              <span className="product-location-modal__product-sku">SKU: {product.sku}</span>
              <span className="product-location-modal__product-meta">
                <Icon name="box" size={14} />
                Stock: {product.stockAvailable} unidades
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
              min={0}
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

          <div className="product-location-modal__locations-grid">
            {AVAILABLE_LOCATIONS.map((loc) => (
              <button
                type="button"
                key={loc.location}
                className={`product-location-modal__location-card ${
                  values.selectedLocation === loc.location
                    ? "product-location-modal__location-card--selected"
                    : ""
                }`}
                onClick={() => setValues((v) => ({ ...v, selectedLocation: loc.location }))}
              >
                <span className="product-location-modal__location-name">{loc.location}</span>
                <span className="product-location-modal__location-spaces">
                  {loc.spaces} espacios
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}