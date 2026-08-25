import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Icon from "../../components/ui/Icon/Icon";
import "./StockManagementPage.css";

const ACTION_CARDS = [
  {
    to: "/gestion-stock/ordenes",
    icon: "box",
    title: "Agregar órdenes de restock",
    description:
      "Creá órdenes para reponer productos que necesitan ser reabastecidos.",
    variant: "yellow",
  },
  {
    to: "/gestion-stock/remitos",
    icon: "truck",
    title: "Agregar remitos de recepción",
    description:
      "Registrá la recepción de mercadería y asignala a posiciones del warehouse.",
    variant: "blue",
  },
];

export default function StockManagementPage() {
  return (
    <div className="stock-management">
      <PageHeader
        title="Gestión de stock"
        subtitle="Administrá las órdenes de restock y los remitos de recepción del warehouse."
      />

      <div className="stock-management__actions">
        {ACTION_CARDS.map((card) => (
          <Link
            to={card.to}
            key={card.to}
            className={`stock-management__card stock-management__card--${card.variant}`}
          >
            <div className="stock-management__card-icon">
              <Icon name={card.icon} size={22} color="currentColor" />
            </div>
            <div className="stock-management__card-body">
              <h3 className="stock-management__card-title">{card.title}</h3>
              <p className="stock-management__card-desc">{card.description}</p>
            </div>
            <Icon
              name="chevronRight"
              size={18}
              className="stock-management__card-chevron"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
