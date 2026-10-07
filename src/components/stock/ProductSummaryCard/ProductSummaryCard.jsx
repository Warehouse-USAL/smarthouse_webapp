import Icon from "../../ui/Icon/Icon";
import Badge from "../../ui/Badge/Badge";
import "./ProductSummaryCard.css";

/*
| Tarjeta resumen de producto compartida por los modales de restock
| (acciones de orden y nueva orden): misma estructura, distinta info.
|
|   thumb | Producto / nombre / SKU / categoría [/ badge] | divisor | métricas
|
| `metrics`: [{ icon, label, value, title? }] — en acciones son
| actual/mínimo/sugerida; en nueva orden los números del producto elegido.
| `badge`: { variant, label } opcional (ej. "Sin ubicación").
*/
export default function ProductSummaryCard({
  imageUrl,
  name,
  sku,
  category,
  metrics = [],
  badge = null,
}) {
  return (
    <div className="product-summary-card">
      <span className="product-summary-card__thumb">
        <Icon name="box" size={28} />
        {imageUrl && <img src={imageUrl} alt="" loading="lazy" />}
      </span>
      <div className="product-summary-card__info">
        <span className="product-summary-card__label">Producto</span>
        <h4 className="product-summary-card__name" title={name}>
          {name}
        </h4>
        <span className="product-summary-card__sku">SKU: {sku}</span>
        {category && (
          <span className="product-summary-card__category">
            <Icon name="box" size={14} />
            Categoría: {category}
          </span>
        )}
        {badge && (
          <span className="product-summary-card__badge">
            <Badge variant={badge.variant} dot>
              {badge.label}
            </Badge>
          </span>
        )}
      </div>
      {metrics.length > 0 && (
        <dl className="product-summary-card__metrics">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="product-summary-card__metric"
              title={metric.title}
            >
              <dt>
                <Icon name={metric.icon} size={14} />
                {metric.label}:
              </dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
