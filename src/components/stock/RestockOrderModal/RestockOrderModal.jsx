import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import "./RestockOrderModal.css";

const PRIORITY_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

export default function RestockOrderModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva orden de restock"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled>Crear orden</Button>
        </>
      }
    >
      <p className="restock-modal__subtitle">
        Completá la información para crear una nueva orden de restock.
      </p>

      <div className="restock-modal__form">
        <Input
          label="Número de orden"
          value="RST-00024"
          disabled
          hint="Se generará automáticamente"
        />

        <Input
          label="Producto"
          iconLeft={<Icon name="search" size={18} />}
          placeholder="Buscar producto o SKU"
        />

        <div className="restock-modal__row">
          <div className="restock-modal__stepper">
            <label>
              Cantidad solicitada <span className="restock-modal__required">*</span>
            </label>
            <div className="restock-modal__stepper-input">
              <button type="button" className="restock-modal__stepper-btn" disabled>
                −
              </button>
              <input type="number" min={1} step={1} placeholder="Ej. 50" />
              <button type="button" className="restock-modal__stepper-btn" disabled>
                +
              </button>
            </div>
          </div>

          <Select
            label="Prioridad"
            options={PRIORITY_OPTIONS}
            placeholder="Seleccioná prioridad"
          />
        </div>
      </div>
    </Modal>
  );
}
