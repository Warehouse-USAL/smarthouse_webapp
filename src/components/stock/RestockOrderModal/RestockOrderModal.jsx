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

const QUANTITY_OPTIONS = Array.from({ length: 100 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

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
          required
        />

        <div className="restock-modal__row">
          <Select
            label="Cantidad solicitada"
            options={QUANTITY_OPTIONS}
            placeholder="Seleccioná cantidad"
            required
          />

          <Select
            label="Prioridad"
            options={PRIORITY_OPTIONS}
            placeholder="Seleccioná prioridad"
            required
          />
        </div>
      </div>
    </Modal>
  );
}
