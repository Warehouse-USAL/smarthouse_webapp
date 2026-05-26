import { useRef, useState } from "react";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import "./CreateProductForm.css";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const EMPTY = {
  name: "",
  sku: "",
  category: "",
  description: "",
  imageUrl: "",
  minimumStock: 0,
  maxQuantityPerOrder: 0,
  unitsPerPallet: 0,
  unitsPerHalfPallet: 0,
  unitsPerBox: 0,
};

const buildInitial = (initial) => {
  if (!initial) return EMPTY;
  return {
    name: initial.name ?? "",
    sku: initial.sku ?? "",
    category: initial.category ?? "",
    description: initial.description ?? "",
    imageUrl: initial.imageUrl ?? "",
    minimumStock: initial.minimumStock ?? 0,
    maxQuantityPerOrder: initial.maxQuantityPerOrder ?? 0,
    unitsPerPallet: initial.unitsPerPallet ?? 0,
    unitsPerHalfPallet: initial.unitsPerHalfPallet ?? 0,
    unitsPerBox: initial.unitsPerBox ?? 0,
  };
};

// Hito 2 §5–§6: el producto se crea con stock 0, sin ubicación, y declara
// CUÁNTAS unidades entran por pallet, medio pallet y caja. Al menos una de
// las tres capacidades tiene que estar definida (>0) para que el producto
// sea asignable a alguna posición.
const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.sku.trim()) errors.sku = "SKU requerido";
  else if (!/^[A-Z0-9-]+$/i.test(values.sku.trim())) errors.sku = "Solo letras, números y guiones";
  if (!values.category) errors.category = "Categoría requerida";
  if (values.minimumStock === "" || Number(values.minimumStock) < 0) {
    errors.minimumStock = "Debe ser ≥ 0";
  }
  const someCapacity =
    Number(values.unitsPerPallet) > 0 ||
    Number(values.unitsPerHalfPallet) > 0 ||
    Number(values.unitsPerBox) > 0;
  if (!someCapacity) {
    errors.unitsPerPallet = "Definí al menos una capacidad";
  }
  return errors;
};

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
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("El archivo debe ser una imagen");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("La imagen no puede superar los 2 MB");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setValues((v) => ({ ...v, imageUrl: dataUrl }));
      setImageError("");
    } catch {
      setImageError("No se pudo leer el archivo");
    }
  };

  const handleClearImage = () => {
    setValues((v) => ({ ...v, imageUrl: "" }));
    setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({
      ...values,
      sku: values.sku.trim().toUpperCase(),
      minimumStock: Number(values.minimumStock),
      maxQuantityPerOrder: Number(values.maxQuantityPerOrder) || 0,
      unitsPerPallet: Number(values.unitsPerPallet) || 0,
      unitsPerHalfPallet: Number(values.unitsPerHalfPallet) || 0,
      unitsPerBox: Number(values.unitsPerBox) || 0,
    });
  };

  const submitLabel = isEdit
    ? submitting ? "Guardando…" : "Guardar cambios"
    : submitting ? "Guardando…" : "Crear producto";

  return (
    <form className="create-product-form" onSubmit={handleSubmit} noValidate>
      <div className="create-product-form__grid">
        <Input
          name="name"
          label="Nombre"
          placeholder="Ej. Mouse inalámbrico"
          value={values.name}
          onChange={handleChange("name")}
          error={errors.name}
          required
        />
        <Input
          name="sku"
          label="SKU"
          placeholder="Ej. MOU-001"
          value={values.sku}
          onChange={handleChange("sku")}
          error={errors.sku}
          disabled={isEdit}
          required
        />
        <Select
          name="category"
          label="Categoría"
          value={values.category}
          onChange={handleChange("category")}
          options={categories}
          placeholder="Seleccioná una categoría"
          error={errors.category}
          required
        />
        <Input
          name="minimumStock"
          label="Punto de reposición"
          type="number"
          min={0}
          step={1}
          value={values.minimumStock}
          onChange={handleChange("minimumStock")}
          error={errors.minimumStock}
          required
        />
        <Input
          name="maxQuantityPerOrder"
          label="Máximo por orden"
          type="number"
          min={0}
          step={1}
          value={values.maxQuantityPerOrder}
          onChange={handleChange("maxQuantityPerOrder")}
        />
        <div className="create-product-form__image-field">
          <Input
            name="imageUrl"
            label="Imagen (Opcional)"
            placeholder="Pegá una URL o subí un archivo"
            value={values.imageUrl.startsWith("data:") ? "" : values.imageUrl}
            onChange={handleChange("imageUrl")}
            disabled={values.imageUrl.startsWith("data:")}
          />
          <div className="create-product-form__image-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="create-product-form__file-input"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              Subir desde mi equipo
            </Button>
            {values.imageUrl && (
              <Button type="button" variant="secondary" onClick={handleClearImage} disabled={submitting}>
                Quitar
              </Button>
            )}
          </div>
          {imageError && <span className="create-product-form__image-error">{imageError}</span>}
          {values.imageUrl && (
            <div className="create-product-form__image-preview">
              <img src={values.imageUrl} alt="Previsualización" />
            </div>
          )}
        </div>
      </div>

      <section className="create-product-form__location">
        <header className="create-product-form__location-header">
          <h3 className="create-product-form__location-title">Capacidad por unidad de almacenamiento</h3>
          <p className="create-product-form__location-subtitle">
            Definí cuántas unidades de este producto entran en cada tipo de unidad de
            almacenamiento. Dejá en 0 las que no apliquen.
          </p>
        </header>
        <div className="create-product-form__location-grid">
          <Input
            name="unitsPerPallet"
            label="Unidades por Pallet"
            type="number"
            min={0}
            step={1}
            value={values.unitsPerPallet}
            onChange={handleChange("unitsPerPallet")}
            error={errors.unitsPerPallet}
          />
          <Input
            name="unitsPerHalfPallet"
            label="Unidades por Medio Pallet"
            type="number"
            min={0}
            step={1}
            value={values.unitsPerHalfPallet}
            onChange={handleChange("unitsPerHalfPallet")}
          />
          <Input
            name="unitsPerBox"
            label="Unidades por Caja"
            type="number"
            min={0}
            step={1}
            value={values.unitsPerBox}
            onChange={handleChange("unitsPerBox")}
          />
        </div>
        {!isEdit && (
          <p className="create-product-form__hint">
            El producto se crea con stock 0 y sin ubicación. Asigná stock más tarde
            desde la pantalla <strong>Asignación de stock</strong>.
          </p>
        )}
      </section>

      <div className="create-product-form__actions">
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
