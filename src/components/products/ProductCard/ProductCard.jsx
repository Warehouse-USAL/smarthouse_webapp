import Icon from "../../ui/Icon/Icon";
import "./ProductCard.css";

const formatLocation = (product) => {
  const zone = product.zone ? `Zona ${product.zone}` : null;
  const line = product.line ? `Línea ${String(product.line).padStart(2, "0")}` : null;
  return [zone, line].filter(Boolean).join(", ") || "Sin asignar";
};

export default function ProductCard({ product, onSelect }) {
  return (
    <article className="product-card" onClick={() => onSelect?.(product)}>
      <div className="product-card__image">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <div className="product-card__image-placeholder">
            <Icon name="box" size={32} />
          </div>
        )}
      </div>

      <div className="product-card__body">
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__sku">SKU: {product.sku}</p>

        <div className="product-card__meta">
          <span className="product-card__meta-row">
            <Icon name="box" size={14} />
            Stock: {product.availableStock ?? 0} unidades
          </span>
          <span className="product-card__meta-row">
            <Icon name="pin" size={14} />
            Ubicación: {formatLocation(product)}
          </span>
        </div>

        <button className="product-card__detail" type="button">
          Ver detalle
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </article>
  );
}
