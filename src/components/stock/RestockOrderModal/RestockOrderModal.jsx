import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import { productService } from "../../../services/productService";
import { restockService } from "../../../services/restockService";
import "./RestockOrderModal.css";

const EMPTY = { product: "", quantity: "", supplier: "" };

export default function RestockOrderModal({ open, onClose, onCreated }) {
  const [values, setValues] = useState(EMPTY);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Cada apertura arranca el formulario limpio y refresca el catálogo de
  // productos (los IDs se persisten, no el SKU).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
      setError(null);

      let cancelled = false;
      setLoadingProducts(true);
      productService
        .list({ size: 200 })
        .then((list) => {
          if (!cancelled) setProducts(list);
        })
        .catch(() => {
          if (!cancelled) setProducts([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingProducts(false);
        });

      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [open]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} — SKU ${p.sku}`,
  }));

  const quantity = Number(values.quantity);
  const isValid =
    !!values.product &&
    Number.isFinite(quantity) &&
    quantity >= 1 &&
    values.supplier.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await restockService.createOrder({
        productId: values.product,
        quantityRequested: quantity,
        supplier: values.supplier.trim(),
      });
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          "No pudimos crear la orden de restock."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva orden de restock"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? "Creando orden…" : "Crear orden"}
          </Button>
        </>
      }
    >
      <p className="restock-modal__subtitle">
        Completá la información para crear una nueva orden de restock.
      </p>

      <div className="restock-modal__form">
        <Select
          label="Producto"
          options={productOptions}
          placeholder={loadingProducts ? "Cargando productos…" : "Seleccioná un producto"}
          value={values.product}
          onChange={set("product")}
          required
        />

        <div className="restock-modal__row">
          <Input
            label="Cantidad solicitada"
            type="number"
            min={1}
            step={1}
            placeholder="Ej. 50"
            value={values.quantity}
            onChange={set("quantity")}
            required
          />

          <Input
            label="Proveedor"
            placeholder="Ej. Distribuidora XYZ"
            value={values.supplier}
            onChange={set("supplier")}
            required
          />
        </div>
      </div>

      {error && <p className="restock-modal__error">{error}</p>}
    </Modal>
  );
}