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

const INITIAL = {
  name: "",
  sku: "",
  category: "",
  availableStock: 0,
  description: "",
  imageUrl: "",
};

const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.sku.trim()) errors.sku = "SKU requerido";
  else if (!/^[A-Z0-9-]+$/i.test(values.sku.trim())) errors.sku = "Solo letras, números y guiones";
  if (!values.category) errors.category = "Categoría requerida";
  if (values.availableStock === "" || Number(values.availableStock) < 0) {
    errors.availableStock = "Debe ser ≥ 0";
  }
  return errors;
};

export default function CreateProductForm({ categories, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(INITIAL);
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
      availableStock: Number(values.availableStock),
    });
  };

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
          name="availableStock"
          label="Stock inicial"
          type="number"
          min={0}
          step={1}
          value={values.availableStock}
          onChange={handleChange("availableStock")}
          error={errors.availableStock}
          required
        />
        <div className="create-product-form__image-field">
          <Input
            name="imageUrl"
            label="Imagen"
            placeholder="Pegá una URL o subí un archivo"
            value={values.imageUrl.startsWith("data:") ? "" : values.imageUrl}
            onChange={handleChange("imageUrl")}
            hint="Opcional"
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

      <div className="create-product-form__actions">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
