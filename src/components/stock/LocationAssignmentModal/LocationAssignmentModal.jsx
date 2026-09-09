import { useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import ProgressBar from "../../ui/ProgressBar/ProgressBar";
import Icon from "../../ui/Icon/Icon";
import "./LocationAssignmentModal.css";

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

export default function LocationAssignmentModal({ open, onClose, product }) {
  const [selectedLocations, setSelectedLocations] = useState([]);

  const toggleLocation = (location) =>
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location]
    );

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar ubicación - Restock"
      size="lg"
      footer={
        <div className="location-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button iconLeft={<Icon name="pin" size={16} />}>
            Asignar ubicación
          </Button>
        </div>
      }
    >
      <p className="location-modal__subtitle">
        Elegí una ubicación disponible para el material recibido.
      </p>

      <div className="location-modal__form">
        {/* ── Sección 1: Producto ──────────────────────────── */}
        <section className="location-modal__section">
          <h4 className="location-modal__section-title">
            <span className="location-modal__section-num">1</span>
            Producto
          </h4>
          <div className="location-modal__product-card">
            <div className="location-modal__product-thumb">
              <Icon name="box" size={24} />
            </div>
            <div className="location-modal__product-info">
              <span className="location-modal__product-name">{product.name}</span>
              <span className="location-modal__product-sku">SKU: {product.sku}</span>
              <span className="location-modal__product-order">Orden: {product.orderId}</span>
              <span className="location-modal__product-received">
                Se recibieron <strong>{product.received} unidades</strong>
              </span>
              <Badge variant="warning" dot>Pendiente ubicación</Badge>
            </div>
          </div>
        </section>

        {/* ── Sección 2: Ubicación actual ──────────────────── */}
        <section className="location-modal__section">
          <h4 className="location-modal__section-title">
            <span className="location-modal__section-num">2</span>
            Ubicación actual del material
          </h4>
          <div className="location-modal__table-wrap">
            <table className="location-modal__table">
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
                    <td className="location-modal__table-loc">{row.location}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[row.status]} dot>
                        {row.statusLabel}
                      </Badge>
                    </td>
                    <td>
                      <div className="location-modal__table-qty">
                        <span className="location-modal__qty-text">
                          {row.qty}/{row.capacity} unidades
                        </span>
                        <ProgressBar
                          value={Math.round((row.qty / row.capacity) * 100)}
                          variant={PROGRESS_VARIANT[row.status]}
                        />
                      </div>
                    </td>
                    <td className="location-modal__table-cap">
                      {row.capacity} unidades
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Sección 3: Ubicaciones disponibles ───────────── */}
        <section className="location-modal__section">
          <h4 className="location-modal__section-title">
            <span className="location-modal__section-num">3</span>
            Ubicaciones disponibles para asignar
          </h4>
          <p className="location-modal__section-hint">
            Seleccioná una ubicación con espacio suficiente para el material recibido.
          </p>
          <div className="location-modal__locations-grid">
            {AVAILABLE_LOCATIONS.map((loc) => (
              <label className="location-modal__location-card" key={loc.location}>
                <input
                  type="checkbox"
                  className="location-modal__location-check"
                  checked={selectedLocations.includes(loc.location)}
                  onChange={() => toggleLocation(loc.location)}
                />
                <span className="location-modal__location-name">{loc.location}</span>
                <span className="location-modal__location-spaces">{loc.spaces} espacios</span>
              </label>
            ))}
            <button type="button" className="location-modal__location-more" disabled>
              <Icon name="plus" size={18} />
              <span>Ver más ubicaciones</span>
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
