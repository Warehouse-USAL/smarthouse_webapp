import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import "./RemitoModal.css";

const DELIVERY_UNIT_OPTIONS = [
  { value: "pallet", label: "Pallet" },
  { value: "medio-pallet", label: "Medio pallet" },
  { value: "caja", label: "Caja" },
];

const EMPTY = { order: "RST-00018", received: "", unit: "" };

export default function RemitoModal({ open, onClose }) {
  const [values, setValues] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
    }
  }, [open]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const discrepancy = (Number(values.received) || 0) - 50;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo remito de recepción"
      size="lg"
      footer={
        <div className="remito-modal__footer">
          <div className="remito-modal__footer-left">
            <Button
              variant="danger-outline"
              iconLeft={<Icon name="x" size={16} />}
            >
              Rechazar pedido
            </Button>

          </div>
          <div className="remito-modal__footer-right">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button iconLeft={<Icon name="check" size={16} />}>
              Aceptar pedido
            </Button>
          </div>
        </div>
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

        {/* ── Sección 3 + 4 + 5: Cantidades ──────────────── */}
        <div className="remito-modal__row">
          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">3</span>
              Cantidad solicitada
            </h4>
            <Input
              type="number"
              value={50}
              disabled
              hint="Extraída de la orden"
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">4</span>
              Cantidad recibida
            </h4>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Ej. 50"
              hint="Unidades"
              value={values.received}
              onChange={set("received")}
              required
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">5</span>
              Discrepancia
            </h4>
            <Input
              type="number"
              value={discrepancy}
              disabled
              hint="Recibida − Solicitada"
            />
          </section>
        </div>

        {/* ── Info box: discrepancia ───────────────────────── */}
        <div className="remito-modal__info-box">
          <Icon name="info" size={20} color="var(--color-info-blue)" />
          <p>
            La discrepancia se calcula como: <strong>cantidad recibida − cantidad solicitada</strong>.
            <br />
            Un valor negativo indica que llegó menos de lo solicitado.
          </p>
        </div>

        {/* ── Sección 6: Unidad de entrega ─────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">6</span>
            Unidad de entrega
          </h4>
          <Select
            options={DELIVERY_UNIT_OPTIONS}
            placeholder="Seleccioná una unidad"
            value={values.unit}
            onChange={set("unit")}
            required
          />
          <span className="remito-modal__field-hint">Ej. Pallet, Medio Pallet, Caja</span>
        </section>
      </div>
    </Modal>
  );
}
