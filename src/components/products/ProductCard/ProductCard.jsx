import Icon from "../../ui/Icon/Icon";
import "./ProductCard.css";

/**
 * Formatea el precio desde centavos (contrato) a string legible.
 * Ejemplo: 149900 → "$1.499,00"
 */
const formatPrice = (price) => {
  if (!price || price.amount_cents == null) return "—";

  const value = price.amount_cents / 100;

  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formatea la ubicación física del producto.
 * El contrato define location con las claves:
 * { zone_code, number_line, position_name, id_zone, id_line, id_position }
 */
const formatLocation = (product) => {
  const loc = product.location;

  if (
    !loc ||
    (!loc.zone_code && !loc.number_line && !loc.position_name)
  ) {
    return "Sin asignar";
  }

  const parts = [];

  if (loc.zone_code) parts.push(`Zona ${loc.zone_code}`);
  if (loc.number_line != null) parts.push(`L${String(loc.number_line).padStart(2, "0")}`);
  if (loc.position_name) parts.push(loc.position_name);

  return parts.join(" · ");
};

/**
 * Formatea las capacidades por unidad de almacenamiento.
 * Campos TBD en el contrato — se leen con fallback a 0.
 */
const formatCapacities = (product) => {
  const out = [];

  if (product.unitsPerPallet > 0) out.push(`${product.unitsPerPallet}/Pallet`);
  if (product.unitsPerHalfPallet > 0) out.push(`${product.unitsPerHalfPallet}/Medio`);
  if (product.unitsPerBox > 0) out.push(`${product.unitsPerBox}/Caja`);

  return out.join(" · ") || "Sin capacidades";
};

/**
 * Devuelve la imagen de portada.
 * El contrato define images[] como { url, alt, is_primary }.
 * La portada es la que tiene is_primary: true; si ninguna lo tiene, la primera.
 */
const getCoverImage = (images = []) => {
  if (images.length === 0) return null;
  return images.find((img) => img.is_primary) ?? images[0];
};

export default function ProductCard({
  product,
  onSelect,
  onEdit,
  onDelete,
}) {
  const stopAnd = (handler) => (e) => {
    e.stopPropagation();
    handler?.(product);
  };

  const images = product.images ?? [];
  const coverImage = getCoverImage(images);

  return (
    <article
      className="product-card"
      onClick={() => onSelect?.(product)}
    >
      <div className="product-card__image">
        {coverImage ? (
          <>
            <img
              src={coverImage.url}
              alt={coverImage.alt || product.name}
            />

            {images.length > 1 && (
              <div className="product-card__gallery-badge">
                +{images.length - 1}
              </div>
            )}
          </>
        ) : (
          <div className="product-card__image-placeholder">
            <Icon name="box" size={32} />
          </div>
        )}
      </div>

      <div className="product-card__body">
        <div className="product-card__heading">
          <div className="product-card__title-block">
            <h3 className="product-card__name">{product.name}</h3>
            <p className="product-card__sku">SKU: {product.sku}</p>
          </div>

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

        <div className="product-card__price-row">
          <span className="product-card__price">
            ${formatPrice(product.price)}
          </span>

          <span className="product-card__tax">
            {product.price?.tax_included ? "IVA incluido" : "IVA no incluido"}
          </span>
        </div>

        {images.length > 1 && (
          <div className="product-card__thumbs">
            {images.map((img, index) => (
              <img
                key={index}
                src={img.url}
                alt={img.alt || `${product.name}-${index}`}
                className={`product-card__thumb ${
                  img.is_primary ? "product-card__thumb--active" : ""
                }`}
              />
            ))}
          </div>
        )}

        <div className="product-card__meta">
          <span className="product-card__meta-row">
            <Icon name="box" size={14} />
            Stock: {product.stock?.available ?? 0} unidades
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