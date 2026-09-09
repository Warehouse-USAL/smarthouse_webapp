import Badge from "../../ui/Badge/Badge";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import "./PendingLocationCard.css";

export default function PendingLocationCard({
  product,
  badge,
  meta = [],
  estadoInline = false,
  onAssign,
}) {
  return (
    <article className="pending-card">
      {badge && (
        <div className="pending-card__badge">
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
        </div>
      )}

      <div className="pending-card__body">
        <div className="pending-card__thumb">
          <Icon name="box" size={44} />
        </div>

        <div className="pending-card__info">
          <h3 className="pending-card__name">{product.name}</h3>
          <span className="pending-card__sku">SKU: {product.sku}</span>
          {meta.map((line) => (
            <span className="pending-card__meta" key={`${line.icon}-${line.text}`}>
              <Icon name={line.icon} size={14} />
              <span>{line.text}</span>
            </span>
          ))}
          {estadoInline && (
            <span className="pending-card__meta pending-card__estado">
              <Icon name="pin" size={14} />
              <span>Estado: Pendiente de ubicación</span>
            </span>
          )}
        </div>
      </div>

      <div className="pending-card__footer">
        {!estadoInline && (
          <span className="pending-card__estado">
            <Icon name="pin" size={14} />
            Estado: Pendiente de ubicación
          </span>
        )}
        <Button
          variant="warning-outline"
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