import Icon from "../../ui/Icon/Icon";
import "./ProductCard.css";

// El producto puede tener stock distribuido en varias posiciones (StockPosicion).
// Por compatibilidad con el listado del catálogo, mostramos:
// - "Sin asignar" si nunca tuvo asignación.
// - El código de la ubicación si el backend tiene la última asignación reflejada
//   en location { zone, line, position }.
// - El total de unidades disponibles del producto.
const formatLocation = (product) => {
  const loc = product.location;
  if (!loc || (!loc.zone && !loc.line && !loc.position)) return "Sin asignar";
  const parts = [];
  if (loc.zone) parts.push(`Zona ${loc.zone}`);
  if (loc.line) parts.push(`L${String(loc.line).padStart(2, "0")}`);
  if (loc.position) parts.push(loc.position);
  return parts.join(" · ");
};

const formatCapacities = (product) => {
  const out = [];
  if (product.unitsPerPallet > 0) out.push(`${product.unitsPerPallet}/Pallet`);
  if (product.unitsPerHalfPallet > 0) out.push(`${product.unitsPerHalfPallet}/Medio`);
  if (product.unitsPerBox > 0) out.push(`${product.unitsPerBox}/Caja`);
  return out.join(" · ") || "Sin capacidades";
};

export default function ProductCard({ product, onSelect, onEdit, onDelete }) {
  const stopAnd = (handler) => (e) => {
    e.stopPropagation();
    handler?.(product);
  };

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
        <div className="product-card__heading">
          <h3 className="product-card__name">{product.name}</h3>
          {(onEdit || onDelete) && (
            <div className="product-card__actions">
              {onEdit && (
                <button
                  type="button"
                  className="product-card__action"
                  onClick={stopAnd(onEdit)}
                  aria-label="Editar producto"
                  title="Editar"
                >
                  <Icon name="edit" size={16} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="product-card__action product-card__action--danger"
                  onClick={stopAnd(onDelete)}
                  aria-label="Eliminar producto"
                  title="Eliminar"
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <p className="product-card__sku">SKU: {product.sku}</p>

        <div className="product-card__meta">
          <span className="product-card__meta-row">
            <Icon name="box" size={14} />
            Stock: {product.availableStock ?? 0} unidades
          </span>
          <span className="product-card__meta-row">
            <Icon name="grid" size={14} />
            Capacidad: {formatCapacities(product)}
          </span>
          <span className="product-card__meta-row">
            <Icon name="pin" size={14} />
            Ubicación: {formatLocation(product)}
          </span>
        </div>
      </div>
    </article>
  );
}
