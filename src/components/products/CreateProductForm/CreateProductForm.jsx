import { useState } from "react";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import { UNITS_OF_MEASURE } from "../../../services/categoryService";
import "./CreateProductForm.css";

const INITIAL = {
  name: "",
  sku: "",
  category: "",
  unitOfMeasure: "unidad",
  minStock: 0,
  description: "",
  imageUrl: "",
};

const validate = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = "Nombre requerido";
  if (!values.sku.trim()) errors.sku = "SKU requerido";
  else if (!/^[A-Z0-9-]+$/i.test(values.sku.trim())) errors.sku = "Solo letras, números y guiones";
  if (!values.category) errors.category = "Categoría requerida";
  if (!values.unitOfMeasure) errors.unitOfMeasure = "Unidad requerida";
  if (values.minStock === "" || Number(values.minStock) < 0) errors.minStock = "Debe ser ≥ 0";
  return errors;
};

export default function CreateProductForm({ categories, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  const handleChange = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ ...values, sku: values.sku.trim().toUpperCase(), minStock: Number(values.minStock) });
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
        <Select
          name="unitOfMeasure"
          label="Unidad de medida"
          value={values.unitOfMeasure}
          onChange={handleChange("unitOfMeasure")}
          options={UNITS_OF_MEASURE}
          error={errors.unitOfMeasure}
          required
        />
        <Input
          name="minStock"
          label="Stock mínimo"
          type="number"
          min={0}
          step={1}
          value={values.minStock}
          onChange={handleChange("minStock")}
          error={errors.minStock}
          required
        />
        <Input
          name="imageUrl"
          label="URL de imagen"
          placeholder="https://…"
          value={values.imageUrl}
          onChange={handleChange("imageUrl")}
          hint="Opcional"
        />
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
