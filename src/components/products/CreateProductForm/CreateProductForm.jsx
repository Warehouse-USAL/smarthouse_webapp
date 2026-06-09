import { useState } from "react";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import "./CreateProductForm.css";

const MAX_IMAGES = 5;

const DEFAULT_SPECS = [
  { label: "Alto", value: "" },
  { label: "Ancho", value: "" },
  { label: "Profundidad", value: "" },
  { label: "Peso", value: "" },
];

const EMPTY = {
  name: "",
  sku: "",
  category: "",
  description: "",
  currency: "ARS",
  images: [],
  price: "",
  includesTaxes: false,
  minimumStock: "",
  maxQuantityPerOrder: "",
  specs: DEFAULT_SPECS,
  active: true,
};

const buildInitial = (initial) => {
  if (!initial) return EMPTY;

  return {
    name: initial.name ?? "",
    sku: initial.sku ?? "",
    category: initial.category ?? "",
    currency: initial.price?.currency ?? "ARS",
    active: initial.active ?? true,
    description: initial.description ?? "",
    images: initial.images ?? [],
    price:
      initial.price?.amount_cents != null
        ? (initial.price.amount_cents / 100).toString()
        : "",
    includesTaxes: initial.price?.tax_included ?? false,
    minimumStock: initial.stock?.min?.toString() ?? "",
    maxQuantityPerOrder:
      initial.order_constraints?.max_quantity_per_order?.toString() ?? "",
    specs: initial.specs?.length ? initial.specs : DEFAULT_SPECS,
  };
};

const validate = (values) => {
  const errors = {};

  if (!values.name.trim())
    errors.name = "Nombre requerido";

  if (!values.sku.trim())
    errors.sku = "SKU requerido";
  else if (!/^[A-Z0-9-]+$/i.test(values.sku.trim()))
    errors.sku = "Solo letras, números y guiones";

  if (!values.category.trim())
    errors.category = "Categoría requerida";

  if (values.price === "" || Number(values.price) < 0)
    errors.price = "Precio inválido";

  if (values.minimumStock === "" || Number(values.minimumStock) < 0)
    errors.minimumStock = "Debe ser ≥ 0";

  return errors;
};

// Devuelve valores limpios en camelCase. La traducción al contrato del backend
// (snake_case, centavos) la hace productService — este form no la conoce.
const buildSubmitValues = (values, coverImageIndex) => ({
  sku: values.sku.trim().toUpperCase(),
  name: values.name.trim(),
  description: values.description.trim(),
  category: values.category.trim(),
  active: values.active,
  currency: values.currency.trim().toUpperCase() || "ARS",
  includesTaxes: values.includesTaxes,
  price: values.price,
  minimumStock: Number(values.minimumStock) || 0,
  maxQuantityPerOrder: Number(values.maxQuantityPerOrder) || 0,
  images: values.images.map((img, idx) => ({
    url: img.url,
    alt: img.alt || values.name.trim() || `Imagen ${idx + 1}`,
    isPrimary: idx === coverImageIndex,
  })),
  specs: values.specs.filter((s) => s.label.trim() && s.value.trim()),
});

const isValidUrl = (str) => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// ── Componente de sección con título ──────────────────────────────────────────
function FormSection({ title, children }) {
  return (
    <fieldset className="cpf-section">
      <legend className="cpf-section__title">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function CreateProductForm({
  categories,
  onSubmit,
  onCancel,
  submitting,
  initial = null,
  mode = "create",
}) {
  const isEdit = mode === "edit";

  const [values, setValues] = useState(() => buildInitial(initial));
  const [errors, setErrors] = useState({});
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [imageUrlError, setImageUrlError] = useState("");
  const [coverImageIndex, setCoverImageIndex] = useState(() => {
    if (!initial?.images?.length) return 0;
    const idx = initial.images.findIndex((img) => img.is_primary);
    return idx === -1 ? 0 : idx;
  });
  const handleChange = (field) => (e) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  // ── Specs ──
  const handleSpecChange = (index, key) => (e) => {
    setValues((v) => {
      const specs = v.specs.map((s, i) =>
        i === index ? { ...s, [key]: e.target.value } : s
      );
      return { ...v, specs };
    });
  };

  const handleAddSpec = () => {
    setValues((v) => ({
      ...v,
      specs: [...v.specs, { label: "", value: "" }],
    }));
  };

  const handleRemoveSpec = (index) => {
    setValues((v) => ({
      ...v,
      specs: v.specs.filter((_, i) => i !== index),
    }));
  };

  // ── Imágenes ──
  const handleAddImage = () => {
    const url = imageUrlDraft.trim();
    if (!url) { setImageUrlError("Ingresá una URL"); return; }
    if (!isValidUrl(url)) { setImageUrlError("La URL no es válida (debe comenzar con http:// o https://)"); return; }
    if (values.images.some((img) => img.url === url)) { setImageUrlError("Ya agregaste esa URL"); return; }
    if (values.images.length >= MAX_IMAGES) { setImageUrlError(`Máximo ${MAX_IMAGES} imágenes`); return; }

    setValues((v) => ({
      ...v,
      images: [...v.images, { url, alt: v.name.trim() || "", is_primary: false }],
    }));
    setImageUrlDraft("");
    setImageUrlError("");
  };

  const handleRemoveImage = (indexToRemove) => {
    setValues((v) => ({ ...v, images: v.images.filter((_, i) => i !== indexToRemove) }));
    setCoverImageIndex((prev) => {
      if (indexToRemove === prev) return 0;
      if (indexToRemove < prev) return prev - 1;
      return prev;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(buildSubmitValues(values, coverImageIndex));
  };

  const submitLabel = isEdit ? (submitting ? "Guardando…" : "Guardar cambios") : (submitting ? "Guardando…" : "Crear producto");
  const draftIsValid = isValidUrl(imageUrlDraft.trim());
  const canAddImage = imageUrlDraft.trim().length > 0 && values.images.length < MAX_IMAGES;

  return (
    <form className="create-product-form" onSubmit={handleSubmit} noValidate>

      {/* ── 1. Identificación ── */}
      <FormSection title="Identificación">
        <div className="cpf-grid cpf-grid--2">
          <Input
            name="name" label="Nombre" placeholder="Ej. Mouse inalámbrico"
            value={values.name} onChange={handleChange("name")}
            error={errors.name} required
          />
          <Input
            name="sku" label="SKU" placeholder="Ej. MOU-001"
            value={values.sku} onChange={handleChange("sku")}
            error={errors.sku} disabled={isEdit} required
          />
          <Select
            name="category" label="Categoría"
            value={values.category} onChange={handleChange("category")}
            options={categories} placeholder="Seleccioná una categoría"
            error={errors.category} required
          />

          {/* ── Estado ── */}
          <Select
            name="active"
            label="Estado"
            value={values.active ? "true" : "false"}
            onChange={(e) =>
              setValues((v) => ({ ...v, active: e.target.value === "true" }))
            }
            options={[
              { value: "true", label: "Activo" },
              { value: "false", label: "Inactivo" },
            ]}
          />
          <div className="cpf-description">
            <label className="cpf-description__label" htmlFor="description">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              className="cpf-description__textarea"
              placeholder="Describí el producto: características, uso, materiales…"
              rows={4}
              value={values.description}
              onChange={handleChange("description")}
            />
          </div>


        </div>
      </FormSection>

      {/* ── 2. Precio ── */}
      <FormSection title="Precio">
        <div className="cpf-grid cpf-grid--3">
          <div className="cpf-price-row">
            <Input
              name="price" label="Precio" type="number" min={0} step={0.01}
              value={values.price} onChange={handleChange("price")}
              error={errors.price} required
            />
            <div className="cpf-currency-field">
              <label className="cpf-currency-field__label" htmlFor="currency">
                Moneda
              </label>
              <input
                id="currency"
                name="currency"
                className="cpf-currency-field__input"
                value={values.currency}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    currency: e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase(),
                  }))
                }
                maxLength={3}
                placeholder="ARS"
              />
            </div>
          </div>

          <Input
            name="minimumStock" label="Punto de reposición" type="number" min={0} step={1}
            value={values.minimumStock} onChange={handleChange("minimumStock")}
            error={errors.minimumStock} required
          />
          <Input
            name="maxQuantityPerOrder" label="Máximo por orden" type="number" min={0} step={1}
            value={values.maxQuantityPerOrder} onChange={handleChange("maxQuantityPerOrder")}
          />

          <div className="cpf-checkbox">
            <label>
              <input
                type="checkbox"
                checked={values.includesTaxes}
                onChange={(e) => setValues((v) => ({ ...v, includesTaxes: e.target.checked }))}
              />
              El precio incluye impuestos
            </label>
          </div>




        </div>
      </FormSection>

      {/* ── 3. Dimensiones y specs ── */}
      <FormSection title="Dimensiones y especificaciones">
        <div className="cpf-specs">
          {values.specs.map((spec, index) => (
            <div key={index} className="cpf-specs__row">
              <Input
                label="Atributo"
                placeholder="Ej. Alto"
                value={spec.label}
                onChange={handleSpecChange(index, "label")}
              />
              <Input
                label="Valor"
                placeholder="Ej. 10 cm"
                value={spec.value}
                onChange={handleSpecChange(index, "value")}
              />
              <button
                type="button"
                className="cpf-specs__remove"
                onClick={() => handleRemoveSpec(index)}
                aria-label="Quitar especificación"
              >
                ✕
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={handleAddSpec}>
            + Agregar especificación
          </Button>
        </div>
      </FormSection>

      {/* ── 4. Imágenes ── */}
      <FormSection title={`Imágenes (${values.images.length}/${MAX_IMAGES})`}>
        <div className="cpf-image-field">
          <div className="cpf-url-row">
            <div className="cpf-url-preview">
              {draftIsValid ? (
                <img
                  src={imageUrlDraft.trim()} alt="Vista previa"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  onLoad={(e) => { e.currentTarget.style.display = "block"; }}
                />
              ) : (
                <span className="cpf-url-preview-placeholder">Vista previa</span>
              )}
            </div>
            <div className="cpf-url-inputs">
              <Input
                name="imageUrl" label="URL de imagen"
                placeholder="https://ejemplo.com/imagen.jpg"
                value={imageUrlDraft}
                onChange={(e) => { setImageUrlDraft(e.target.value); setImageUrlError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddImage(); } }}
                error={imageUrlError}
                disabled={submitting || values.images.length >= MAX_IMAGES}
              />
              <Button type="button" variant="secondary" onClick={handleAddImage}
                disabled={submitting || !canAddImage}>
                Agregar
              </Button>
            </div>
          </div>

          {values.images.length > 0 && (
            <div className="cpf-images-grid">
              {values.images.map((img, index) => {
                const isCover = index === coverImageIndex;
                return (
                  <div key={img.url} className={`cpf-image-card ${isCover ? "cpf-image-card--cover" : ""}`}>
                    <div className="cpf-image-wrapper">
                      <img src={img.url} alt={img.alt || `Imagen ${index + 1}`} />
                      {isCover && <div className="cpf-cover-badge">PORTADA</div>}
                    </div>
                    <div className="cpf-image-meta">
                      <input
                        className="cpf-image-alt-input"
                        type="text"
                        placeholder="Texto alternativo"
                        value={img.alt}
                        onChange={(e) => {
                          const newAlt = e.target.value;
                          setValues((v) => ({
                            ...v,
                            images: v.images.map((im, i) =>
                              i === index ? { ...im, alt: newAlt } : im
                            ),
                          }));
                        }}
                      />
                    </div>
                    <div className="cpf-image-buttons">
                      {!isCover && (
                        <Button type="button" variant="secondary" onClick={() => setCoverImageIndex(index)}>
                          Usar como portada
                        </Button>
                      )}
                      <Button type="button" variant="secondary"
                        onClick={() => handleRemoveImage(index)} disabled={submitting}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FormSection>

      {!isEdit && (
        <p className="cpf-hint">
          El producto se crea con stock 0 y sin ubicación. Asigná stock más
          tarde desde la pantalla <strong>Asignación de stock</strong>.
        </p>
      )}

      <div className="cpf-actions">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}