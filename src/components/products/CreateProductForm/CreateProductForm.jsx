import { useMemo, useRef, useState } from "react";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import { warehouseConfigService } from "../../../services/warehouseConfigService";
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
  availableStock: 0,
  reorderPoint: 0,
  description: "",
  imageUrl: "",
  zone: "",
  line: "",
  position: "",
  height: "",
};

const buildInitial = (initial) => {
  if (!initial) return EMPTY;
  return {
    name: initial.name ?? "",
    sku: initial.sku ?? "",
    category: initial.category ?? "",
    availableStock: initial.availableStock ?? 0,
    reorderPoint: initial.reorderPoint ?? 0,
    description: initial.description ?? "",
    imageUrl: initial.imageUrl ?? "",
    zone: initial.zone ?? "",
    line: initial.line != null ? String(initial.line) : "",
    position: initial.position != null ? String(initial.position) : "",
    height: initial.height != null ? String(initial.height) : "",
  };
};

const buildRange = (count) =>
  Array.from({ length: Math.max(0, Number(count) || 0) }, (_, i) => {
    const v = String(i + 1);
    return { value: v, label: v };
  });

const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.sku.trim()) errors.sku = "SKU requerido";
  else if (!/^[A-Z0-9-]+$/i.test(values.sku.trim())) errors.sku = "Solo letras, números y guiones";
  if (!values.category) errors.category = "Categoría requerida";
  if (values.availableStock === "" || Number(values.availableStock) < 0) {
    errors.availableStock = "Debe ser ≥ 0";
  }
  if (values.reorderPoint === "" || Number(values.reorderPoint) < 0) {
    errors.reorderPoint = "Debe ser ≥ 0";
  }
  if (!values.zone) errors.zone = "Zona requerida";
  if (!values.line) errors.line = "Línea requerida";
  if (!values.position) errors.position = "Posición requerida";
  if (!values.height) errors.height = "Altura requerida";
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

  const [warehouseConfig] = useState(() => warehouseConfigService.get());

  const zoneOptions = useMemo(
    () => (warehouseConfig?.zones || []).map((z) => ({ value: z.id, label: z.name })),
    [warehouseConfig]
  );

  const selectedZone = useMemo(
    () => (warehouseConfig?.zones || []).find((z) => z.id === values.zone),
    [warehouseConfig, values.zone]
  );

  const lineOptions = useMemo(() => buildRange(selectedZone?.lines), [selectedZone]);
  const positionOptions = useMemo(() => buildRange(selectedZone?.positions), [selectedZone]);
  const heightOptions = useMemo(() => buildRange(selectedZone?.heights), [selectedZone]);

  const handleChange = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const handleZoneChange = (e) => {
    const nextZone = e.target.value;
    setValues((v) => ({ ...v, zone: nextZone, line: "", position: "", height: "" }));
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
      reorderPoint: Number(values.reorderPoint),
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
        <Input
          name="reorderPoint"
          label="Punto de reposición"
          type="number"
          min={0}
          step={1}
          value={values.reorderPoint}
          onChange={handleChange("reorderPoint")}
          error={errors.reorderPoint}
          required
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
          <h3 className="create-product-form__location-title">Asignar ubicación</h3>
          <p className="create-product-form__location-subtitle">
            Asigná la ubicación donde se almacenará este producto.
          </p>
        </header>
        <div className="create-product-form__location-grid">
          <Select
            name="zone"
            label="Zona"
            value={values.zone}
            onChange={handleZoneChange}
            options={zoneOptions}
            placeholder="Seleccioná zona"
            error={errors.zone}
            required
          />
          <Select
            name="line"
            label="Línea"
            value={values.line}
            onChange={handleChange("line")}
            options={lineOptions}
            placeholder="Seleccioná línea"
            error={errors.line}
            disabled={!values.zone}
            required
          />
          <Select
            name="position"
            label="Posición"
            value={values.position}
            onChange={handleChange("position")}
            options={positionOptions}
            placeholder="Seleccioná posición"
            error={errors.position}
            disabled={!values.zone}
            required
          />
          <Select
            name="height"
            label="Altura"
            value={values.height}
            onChange={handleChange("height")}
            options={heightOptions}
            placeholder="Seleccioná altura"
            error={errors.height}
            disabled={!values.zone}
            required
          />
        </div>
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
