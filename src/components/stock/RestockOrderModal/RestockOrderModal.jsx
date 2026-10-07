import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import ProductSummaryCard from "../ProductSummaryCard/ProductSummaryCard";
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

  const subtitle = fromAlert
    ? hasSuggestion
      ? "Confirmá la orden con la cantidad sugerida por el sistema."
      : "Indicá cuánto querés solicitar de este producto."
    : "Elegí el producto y la cantidad a solicitar.";

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
      subtitle={subtitle}
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
      {/* ── Producto (misma card que el modal de acciones) ─── */}
      {detail && (
        <ProductSummaryCard
          imageUrl={detail.imageUrl}
          name={detail.name}
          sku={detail.sku}
          category={detail.category}
          metrics={[
            {
              icon: "box",
              label: "Stock actual",
              value: units(detail.availableStock),
            },
            {
              icon: "alert",
              label: detail.thresholdLabel,
              value: units(detail.threshold),
            },
            {
              icon: "chart",
              label: "Cantidad sugerida",
              value: hasSuggestion ? units(detail.suggestedQuantity) : "Sin dato",
              title: hasSuggestion
                ? `Stock objetivo ${detail.targetStock} menos la posición de inventario ${detail.inventoryPosition} (disponible ${detail.availableStock} + en tránsito ${detail.onOrderStock}). Lo calcula el backend.`
                : "La calcula el backend en POST /metrics/restock-suggestions. Todavía no está disponible.",
            },
          ]}
        />
      )}

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

      {/* ── Números del producto: ya van en la card ────────── */}

      {fromAlert && hasSuggestion && (
        <div className="restock-modal__note">
          <Icon name="info" size={16} />
          <span>
            Se generará la orden con la cantidad sugerida para alcanzar el stock
            óptimo.
          </span>
        </div>
      )}

      {fromAlert && !hasSuggestion && (
        <div className="restock-modal__note">
          <Icon name="info" size={16} />
          <span>
            El sistema todavía no sugiere una cantidad: indicala vos en el
            campo de abajo.
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
