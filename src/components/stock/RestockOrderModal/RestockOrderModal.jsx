import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import { restockService } from "../../../services/restockService";
import { errorText } from "../../../lib/apiError";
import { toRestockAlert } from "../../../lib/restockSuggestion";
import "./RestockOrderModal.css";

/*
| El modal tiene dos modos:
|
|   · Desde una alerta (`alert`): el producto ya está decidido. La cantidad la
|     trae el backend (POST /metrics/restock-suggestions); si ese endpoint
|     todavía no está desplegado la alerta llega sin cantidad y el campo se pide
|     igual que en el modo libre — nunca se rellena con un número inventado.
|   · En blanco (sin `alert`, entrando por la tarjeta "Agregar órdenes de
|     restock"): el formulario arranca vacío y el operador elige producto y
|     cantidad. Al elegir producto se muestran sus números para que la decisión
|     no sea a ciegas.
|
| El proveedor NO se pide: el backend lo exige (@NotBlank supplier en
| CreateRestockOrderRequest) pero el producto no lo guarda y el diseño no lo
| contempla, así que viaja con este valor fijo hasta que exista el dato.
*/
const SUPPLIER_PLACEHOLDER = "Sin especificar";

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

export default function RestockOrderModal({
  open,
  alert,
  products = [],
  onClose,
  onCreated,
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fromAlert = Boolean(alert);

  // Cada apertura arranca limpia: en modo alerta se precarga lo decidido por el
  // sistema; en modo libre, vacío — nunca se eligió producto ni cantidad.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reinicio del form al abrir */
    setProductId(alert?.productId ?? "");
    setQuantity(
      alert?.suggestedQuantity != null ? String(alert.suggestedQuantity) : ""
    );
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, alert]);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} — ${product.sku}`,
      })),
    [products]
  );

  // Los números que se muestran: los de la alerta, o los del producto elegido.
  const detail = useMemo(() => {
    if (fromAlert) return alert;
    return toRestockAlert(products.find((p) => p.id === productId));
  }, [fromAlert, alert, products, productId]);

  const quantityNumber = Number(quantity) || 0;
  const canSubmit = !submitting && Boolean(productId) && quantityNumber > 0;

  // ¿El backend ya calculó cuánto pedir para este producto?
  const hasSuggestion = detail?.suggestedQuantity != null;

  // El campo de cantidad aparece siempre que no haya una sugerencia que
  // confirmar: en el modo libre, y también desde una alerta sin cantidad.
  const asksQuantity = !fromAlert || !hasSuggestion;

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const order = await restockService.createOrder({
        productId,
        quantityRequested: quantityNumber,
        supplier: SUPPLIER_PLACEHOLDER,
      });
      onCreated?.(order);
      onClose?.();
    } catch (e) {
      setError(
        errorText(e, {
          PRODUCT_NOT_FOUND: "El producto no existe o está inactivo.",
        }, "No se pudo crear la orden de restock. Intentá de nuevo.")
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
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? "Creando…" : "Crear orden"}
          </Button>
        </>
      }
    >
      <p className="restock-modal__subtitle">
        {fromAlert && hasSuggestion ? (
          <>
            Se generará una orden de restock con el producto y{" "}
            <strong>la cantidad sugerida por el sistema</strong>.
          </>
        ) : fromAlert ? (
          <>
            Indicá cuánto querés solicitar de este producto.{" "}
            <strong>El sistema todavía no sugiere una cantidad.</strong>
          </>
        ) : (
          <>Elegí el producto y la cantidad que querés solicitar al proveedor.</>
        )}
      </p>

      {/* ── Producto ─────────────────────────────────────── */}
      {fromAlert ? (
        <div className="restock-modal__product">
          <div className="restock-modal__thumb">
            <Icon name="box" size={28} />
            {detail.imageUrl && <img src={detail.imageUrl} alt="" />}
          </div>
          <div className="restock-modal__product-info">
            <span className="restock-modal__product-label">Producto</span>
            <h4 className="restock-modal__product-name">{detail.name}</h4>
            <span className="restock-modal__product-sku">SKU: {detail.sku}</span>
            {detail.category && (
              <span className="restock-modal__product-category">
                <Icon name="box" size={14} />
                Categoría: {detail.category}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {asksQuantity && (
        <div className="restock-modal__form">
          {!fromAlert && (
            <Select
              label="Producto"
              placeholder="Seleccioná un producto"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={productOptions}
              required
            />
          )}

          <Input
            label="Cantidad solicitada"
            type="number"
            min={1}
            step={1}
            placeholder="Ej. 50"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            hint={
              hasSuggestion
                ? `El sistema sugiere ${units(detail.suggestedQuantity)}.`
                : "Unidades a solicitar al proveedor."
            }
            required
          />

          {hasSuggestion && detail.suggestedQuantity > 0 && (
            <button
              type="button"
              className="restock-modal__use-suggested"
              onClick={() => setQuantity(String(detail.suggestedQuantity))}
            >
              <Icon name="chart" size={14} />
              Usar la cantidad sugerida ({detail.suggestedQuantity})
            </button>
          )}
        </div>
      )}

      {/* ── Números del producto ─────────────────────────── */}
      {detail && (
        <div className="restock-modal__stats">
          <div className="restock-modal__stat">
            <span className="restock-modal__stat-head">
              <Icon name="box" size={14} />
              Stock actual
            </span>
            <strong className="restock-modal__stat-value">
              {units(detail.availableStock)}
            </strong>
          </div>

          <div className="restock-modal__stat">
            <span className="restock-modal__stat-head">
              <Icon name="alert" size={14} />
              {detail.thresholdLabel}
            </span>
            <strong className="restock-modal__stat-value">
              {units(detail.threshold)}
            </strong>
          </div>

          <div className="restock-modal__stat restock-modal__stat--suggested">
            <span className="restock-modal__stat-head">
              <Icon name="chart" size={14} />
              Cantidad sugerida
            </span>
            <strong
              className="restock-modal__stat-value"
              title={
                hasSuggestion
                  ? `Stock objetivo ${detail.targetStock} menos la posición de inventario ${detail.inventoryPosition} (disponible ${detail.availableStock} + en tránsito ${detail.onOrderStock}). Lo calcula el backend.`
                  : "La calcula el backend en POST /metrics/restock-suggestions. Todavía no está disponible."
              }
            >
              {hasSuggestion ? units(detail.suggestedQuantity) : "Sin dato"}
              <Icon name="info" size={14} />
            </strong>
          </div>
        </div>
      )}

      {fromAlert && hasSuggestion && (
        <div className="restock-modal__note">
          <Icon name="info" size={16} />
          <span>
            Se generará la orden con la cantidad sugerida para alcanzar el stock
            óptimo.
          </span>
        </div>
      )}

      {error && (
        <StatusBanner
          statusBannerState="status-banner-error"
          icon={<Icon name="alert" size={16} />}
          text={error}
        />
      )}
    </Modal>
  );
}
