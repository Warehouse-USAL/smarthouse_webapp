import { useRef, useState } from "react";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import "./CreateProductForm.css";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 5;

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
  images: [],
  coverImageIndex: 0,
  price: 0,
  includesTaxes: false,
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
    images: initial.images ?? [],
    coverImageIndex:
      initial.coverImageIndex ?? 0,
    price: initial.price ?? 0,
    includesTaxes:
      initial.includesTaxes ?? false,
    minimumStock:
      initial.minimumStock ?? 0,
    maxQuantityPerOrder:
      initial.maxQuantityPerOrder ?? 0,
    unitsPerPallet:
      initial.unitsPerPallet ?? 0,
    unitsPerHalfPallet:
      initial.unitsPerHalfPallet ?? 0,
    unitsPerBox:
      initial.unitsPerBox ?? 0,
  };
};

const validate = (values) => {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Nombre requerido";
  }

  if (!values.sku.trim()) {
    errors.sku = "SKU requerido";
  } else if (
    !/^[A-Z0-9-]+$/i.test(
      values.sku.trim()
    )
  ) {
    errors.sku =
      "Solo letras, números y guiones";
  }

  if (!values.category) {
    errors.category =
      "Categoría requerida";
  }

  if (
    values.price === "" ||
    Number(values.price) < 0
  ) {
    errors.price = "Precio inválido";
  }

  if (
    values.minimumStock === "" ||
    Number(values.minimumStock) < 0
  ) {
    errors.minimumStock = "Debe ser ≥ 0";
  }

  const someCapacity =
    Number(values.unitsPerPallet) > 0 ||
    Number(values.unitsPerHalfPallet) >
      0 ||
    Number(values.unitsPerBox) > 0;

  if (!someCapacity) {
    errors.unitsPerPallet =
      "Definí al menos una capacidad";
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

  const [values, setValues] = useState(() =>
    buildInitial(initial)
  );

  const [errors, setErrors] = useState({});
  const [imageError, setImageError] =
    useState("");

  const fileInputRef = useRef(null);

  const handleChange = (field) => (e) => {
    setValues((v) => ({
      ...v,
      [field]: e.target.value,
    }));
  };

  const handleFileChange = async (e) => {
    const files = Array.from(
      e.target.files || []
    );

    if (files.length === 0) return;

    const remainingSlots =
      MAX_IMAGES - values.images.length;

    if (remainingSlots <= 0) {
      setImageError(
        `Máximo ${MAX_IMAGES} imágenes`
      );
      return;
    }

    if (files.length > remainingSlots) {
      setImageError(
        `Solo podés subir ${remainingSlots} imagen(es) más`
      );
      return;
    }

    try {
      const newImages = [];

      for (const file of files) {
        if (
          !file.type.startsWith("image/")
        ) {
          setImageError(
            "Todos los archivos deben ser imágenes"
          );
          return;
        }

        if (
          file.size > MAX_IMAGE_BYTES
        ) {
          setImageError(
            "Cada imagen debe pesar menos de 2 MB"
          );
          return;
        }

        const dataUrl =
          await readFileAsDataUrl(file);

        newImages.push(dataUrl);
      }

      setValues((v) => ({
        ...v,
        images: [...v.images, ...newImages],
      }));

      setImageError("");
    } catch {
      setImageError(
        "No se pudieron leer las imágenes"
      );
    }
  };

  const handleRemoveImage = (
    indexToRemove
  ) => {
    setValues((v) => {
      const updatedImages = v.images.filter(
        (_, index) =>
          index !== indexToRemove
      );

      let updatedCoverIndex =
        v.coverImageIndex;

      if (
        indexToRemove ===
        v.coverImageIndex
      ) {
        updatedCoverIndex = 0;
      } else if (
        indexToRemove <
        v.coverImageIndex
      ) {
        updatedCoverIndex =
          v.coverImageIndex - 1;
      }

      return {
        ...v,
        images: updatedImages,
        coverImageIndex:
          updatedImages.length === 0
            ? 0
            : updatedCoverIndex,
      };
    });
  };

  const handleSetCoverImage = (
    index
  ) => {
    setValues((v) => ({
      ...v,
      coverImageIndex: index,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const errs = validate(values);

    setErrors(errs);

    if (Object.keys(errs).length > 0)
      return;

    onSubmit({
      ...values,
      sku: values.sku
        .trim()
        .toUpperCase(),
      price:
        Number(values.price) || 0,
      includesTaxes:
        values.includesTaxes,
      minimumStock: Number(
        values.minimumStock
      ),
      maxQuantityPerOrder:
        Number(
          values.maxQuantityPerOrder
        ) || 0,
      unitsPerPallet:
        Number(
          values.unitsPerPallet
        ) || 0,
      unitsPerHalfPallet:
        Number(
          values.unitsPerHalfPallet
        ) || 0,
      unitsPerBox:
        Number(values.unitsPerBox) ||
        0,
    });
  };

  const submitLabel = isEdit
    ? submitting
      ? "Guardando…"
      : "Guardar cambios"
    : submitting
      ? "Guardando…"
      : "Crear producto";

  return (
    <form
      className="create-product-form"
      onSubmit={handleSubmit}
      noValidate
    >
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
          onChange={handleChange(
            "category"
          )}
          options={categories}
          placeholder="Seleccioná una categoría"
          error={errors.category}
          required
        />

        <Input
          name="price"
          label="Precio"
          type="number"
          min={0}
          step={0.01}
          value={values.price}
          onChange={handleChange("price")}
          error={errors.price}
          required
        />

        <Input
          name="minimumStock"
          label="Punto de reposición"
          type="number"
          min={0}
          step={1}
          value={values.minimumStock}
          onChange={handleChange(
            "minimumStock"
          )}
          error={errors.minimumStock}
          required
        />

        <Input
          name="maxQuantityPerOrder"
          label="Máximo por orden"
          type="number"
          min={0}
          step={1}
          value={
            values.maxQuantityPerOrder
          }
          onChange={handleChange(
            "maxQuantityPerOrder"
          )}
        />

        <div className="create-product-form__checkbox">
          <label>
            <input
              type="checkbox"
              checked={
                values.includesTaxes
              }
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  includesTaxes:
                    e.target.checked,
                }))
              }
            />

            El precio incluye impuestos
          </label>
        </div>

        <div className="create-product-form__image-field">
          <div className="create-product-form__image-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="create-product-form__file-input"
              onChange={handleFileChange}
            />

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                submitting ||
                values.images.length >=
                  MAX_IMAGES
              }
            >
              Subir imágenes
            </Button>

            <span>
              {values.images.length}/
              {MAX_IMAGES} imágenes
            </span>
          </div>

          {imageError && (
            <span className="create-product-form__image-error">
              {imageError}
            </span>
          )}

          {values.images.length > 0 && (
            <div className="create-product-form__images-grid">
              {values.images.map(
                (img, index) => {
                  const isCover =
                    index ===
                    values.coverImageIndex;

                  return (
                    <div
                      key={index}
                      className={`create-product-form__image-card ${
                        isCover
                          ? "create-product-form__image-card--cover"
                          : ""
                      }`}
                    >
                      <div className="create-product-form__image-wrapper">
                        <img
                          src={img}
                          alt={`Preview ${
                            index + 1
                          }`}
                        />

                        {isCover && (
                          <div className="create-product-form__cover-badge">
                            PORTADA
                          </div>
                        )}
                      </div>

                      <div className="create-product-form__image-buttons">
                        {!isCover && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              handleSetCoverImage(
                                index
                              )
                            }
                          >
                            Usar como portada
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            handleRemoveImage(
                              index
                            )
                          }
                          disabled={
                            submitting
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      <section className="create-product-form__location">
        <header className="create-product-form__location-header">
          <h3 className="create-product-form__location-title">
            Capacidad por unidad de
            almacenamiento
          </h3>

          <p className="create-product-form__location-subtitle">
            Definí cuántas unidades de
            este producto entran en cada
            tipo de unidad de
            almacenamiento. Dejá en 0 las
            que no apliquen.
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
            onChange={handleChange(
              "unitsPerPallet"
            )}
            error={
              errors.unitsPerPallet
            }
          />

          <Input
            name="unitsPerHalfPallet"
            label="Unidades por Medio Pallet"
            type="number"
            min={0}
            step={1}
            value={
              values.unitsPerHalfPallet
            }
            onChange={handleChange(
              "unitsPerHalfPallet"
            )}
          />

          <Input
            name="unitsPerBox"
            label="Unidades por Caja"
            type="number"
            min={0}
            step={1}
            value={values.unitsPerBox}
            onChange={handleChange(
              "unitsPerBox"
            )}
          />
        </div>

        {!isEdit && (
          <p className="create-product-form__hint">
            El producto se crea con
            stock 0 y sin ubicación.
            Asigná stock más tarde desde
            la pantalla{" "}
            <strong>
              Asignación de stock
            </strong>
            .
          </p>
        )}
      </section>

      <div className="create-product-form__actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          disabled={submitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}