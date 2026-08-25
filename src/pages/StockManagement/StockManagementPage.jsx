import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Icon from "../../components/ui/Icon/Icon";
import RestockOrderModal from "../../components/stock/RestockOrderModal/RestockOrderModal";
import RemitoModal from "../../components/stock/RemitoModal/RemitoModal";
import "./StockManagementPage.css";

const ACTION_CARDS = [
  {
    key: "restock",
    icon: "box",
    title: "Agregar órdenes de restock",
    description:
      "Creá órdenes para solicitar mercaderia a tus proovedores.",
    note: "La orden quedará pendiente hasta que se registre el remito de entrega.",
    variant: "yellow",
  },
  {
    key: "receiving",
    icon: "truck",
    title: "Agregar remitos de recepción",
    description:
      "Registrá los remitos de entrega recibidos de tus proovedores.",
    note: "Al confirmar la recepción, el stock se actualizará automáticamente.",
    variant: "blue",
  },
];

export default function StockManagementPage() {
  const [restockOpen, setRestockOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);

  const handleOpen = (key) => {
    if (key === "restock") setRestockOpen(true);
    if (key === "receiving") setReceivingOpen(true);
  };

  return (
    <div className="stock-management">
      <PageHeader
        title="Gestión de stock"
        subtitle="Administrá las órdenes de restock y los remitos de recepción del warehouse."
      />

      <div className="stock-management__actions">
        {ACTION_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`stock-management__card stock-management__card--${card.variant}`}
            onClick={() => handleOpen(card.key)}
          >
            <div className="stock-management__card-icon">
              <Icon name={card.icon} size={22} color="currentColor" />
            </div>
            <div className="stock-management__card-body">
              <h3 className="stock-management__card-title">{card.title}</h3>
              <p className="stock-management__card-desc">
                {card.description}
                <br />
                {card.note}
              </p>
            </div>
            <Icon
              name="chevronRight"
              size={18}
              className="stock-management__card-chevron"
            />
          </button>
        ))}
      </div>

      <RestockOrderModal open={restockOpen} onClose={() => setRestockOpen(false)} />
      <RemitoModal open={receivingOpen} onClose={() => setReceivingOpen(false)} />
    </div>
  );
}
