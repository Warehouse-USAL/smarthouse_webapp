import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import ProgressBar from "../../ui/ProgressBar/ProgressBar";
import Icon from "../../ui/Icon/Icon";
import "./RemitoModal.css";

const DELIVERY_UNIT_OPTIONS = [
  { value: "pallet", label: "Pallet" },
  { value: "medio-pallet", label: "Medio pallet" },
  { value: "caja", label: "Caja" },
];

const CURRENT_LOCATIONS = [
  { location: "A-01-01", status: "occupied", statusLabel: "Ocupada", qty: 35, capacity: 50 },
  { location: "A-01-02", status: "full", statusLabel: "Llena", qty: 50, capacity: 50 },
  { location: "A-02-01", status: "empty", statusLabel: "Vacía", qty: 0, capacity: 50 },
  { location: "B-01-01", status: "occupied", statusLabel: "Ocupada", qty: 20, capacity: 50 },
];

const AVAILABLE_LOCATIONS = [
  { location: "A-02-01", spaces: 20 },
  { location: "B-01-01", spaces: 50 },
  { location: "B-02-03", spaces: 50 },
];

const STATUS_VARIANT = {
  occupied: "success",
  full: "danger",
  empty: "neutral",
};

const PROGRESS_VARIANT = {
  occupied: "success",
  full: "danger",
  empty: "danger",
};

const EMPTY = { order: "RST-00018", quantity: "", unit: "", locations: [] };

export default function RemitoModal({ open, onClose }) {
  const [values, setValues] = useState(EMPTY);

  // Cada apertura arranca con el formulario limpio.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
    }
  }, [open]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const toggleLocation = (location) =>
    setValues((v) => ({
      ...v,
      locations: v.locations.includes(location)
        ? v.locations.filter((l) => l !== location)
        : [...v.locations, location],
    }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo remito de recepción"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled>Guardar remito</Button>
        </>
      }
    >
      <p className="remito-modal__subtitle">
        Completá la información para registrar la recepción de mercadería.
      </p>

      <div className="remito-modal__form">
        {/* ── Sección 1: Orden ─────────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">1</span>
            Seleccioná la orden de restock
          </h4>
          <Select
            options={[
              { value: "RST-00018", label: "RST-00018 - 19/05/2024 - Logitech Argentina" },
            ]}
            value={values.order}
            onChange={set("order")}
          />
          <div className="remito-modal__info">
            <Badge variant="warning" dot>Pendiente</Badge>
            <span>Cantidad solicitada: <strong>50 unidades</strong></span>
          </div>
        </section>

        {/* ── Sección 2: Producto ──────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">2</span>
            Producto
          </h4>
          <div className="remito-modal__product-card">
            <div className="remito-modal__product-thumb">
              <Icon name="box" size={24} />
            </div>
            <div className="remito-modal__product-info">
              <span className="remito-modal__product-name">Mouse inalámbrico Logitech M185</span>
              <span className="remito-modal__product-sku">SKU: MOU-001</span>
            </div>
          </div>
        </section>

        {/* ── Sección 3 + 4: Cantidad y Unidad ────────────── */}
        <div className="remito-modal__row">
          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">3</span>
              Cantidad recibida
            </h4>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Ej. 50"
              hint="Unidades"
              value={values.quantity}
              onChange={set("quantity")}
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">4</span>
              Unidad de entrega
            </h4>
            <Select
              options={DELIVERY_UNIT_OPTIONS}
              placeholder="Seleccioná una unidad"
              value={values.unit}
              onChange={set("unit")}
            />
            <span className="remito-modal__field-hint">Ej. Pallet, Medio Pallet, Caja</span>
          </section>
        </div>

        {/* ── Sección 5: Ubicación actual ──────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">5</span>
            Ubicación actual del material
          </h4>
          <div className="remito-modal__table-wrap">
            <table className="remito-modal__table">
              <thead>
                <tr>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Cantidad actual</th>
                  <th>Capacidad</th>
                </tr>
              </thead>
              <tbody>
                {CURRENT_LOCATIONS.map((row) => (
                  <tr key={row.location}>
                    <td className="remito-modal__table-loc">{row.location}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[row.status]} dot>
                        {row.statusLabel}
                      </Badge>
                    </td>
                    <td>
                      <div className="remito-modal__table-qty">
                        <span className="remito-modal__qty-text">{row.qty}/{row.capacity} unidades</span>
                        <ProgressBar
                          value={Math.round((row.qty / row.capacity) * 100)}
                          variant={PROGRESS_VARIANT[row.status]}
                        />
                      </div>
                    </td>
                    <td className="remito-modal__table-cap">{row.capacity} unidades</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Sección 6: Ubicaciones disponibles ───────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">6</span>
            Ubicaciones disponibles para asignar el material recibido
          </h4>
          <div className="remito-modal__locations-grid">
            {AVAILABLE_LOCATIONS.map((loc) => (
              <label className="remito-modal__location-card" key={loc.location}>
                <input
                  type="checkbox"
                  className="remito-modal__location-check"
                  checked={values.locations.includes(loc.location)}
                  onChange={() => toggleLocation(loc.location)}
                />
                <span className="remito-modal__location-name">{loc.location}</span>
                <span className="remito-modal__location-spaces">{loc.spaces} espacios</span>
              </label>
            ))}
            <button type="button" className="remito-modal__location-more" disabled>
              <Icon name="plus" size={18} />
              <span>Ver más ubicaciones</span>
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
