import Badge from "../../ui/Badge/Badge";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import "./RestockPendingCard.css";

export default function RestockPendingCard({ product, onAssign }) {
  return (
    <article className="restock-card">
      <div className="restock-card__badge">
        <Badge variant="success" dot>Restock aceptado</Badge>
      </div>

      <div className="restock-card__body">
        <div className="restock-card__thumb">
          <Icon name="box" size={24} />
        </div>

        <div className="restock-card__info">
          <h3 className="restock-card__name">{product.name}</h3>
          <span className="restock-card__sku">SKU: {product.sku}</span>
          <span className="restock-card__order">Orden: {product.orderId}</span>
          <span className="restock-card__received">{product.received} unidades</span>
          <span className="restock-card__date">Recepción: {product.receivedAt}</span>
        </div>
      </div>

      <div className="restock-card__footer">
        <span className="restock-card__location-status">
          <Icon name="pin" size={14} />
          Pendiente de ubicación
        </span>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Icon name="pin" size={14} />}
          onClick={() => onAssign?.(product)}
        >
          Asignar ubicación
        </Button>
      </div>
    </article>
  );
}
