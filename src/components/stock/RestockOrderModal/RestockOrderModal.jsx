import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import { restockService } from "../../../services/restockService";
import { errorText } from "../../../lib/apiError";
import { buildOnOrderStock, toRestockAlert } from "../../../lib/restockSuggestion";
import "./RestockOrderModal.css";

/*
| El modal tiene dos modos:
|
|   · Desde una alerta (`alert`): el producto ya está decidido y la cantidad
|     viene sugerida. El operador la confirma o la edita.
|   · En blanco (sin `alert`, entrando por la tarjeta "Agregar órdenes de
|     restock"): el formulario arranca vacío y el operador elige producto y
|     cantidad. Al elegir producto se muestran sus números para que la decisión
|     no sea a ciegas, y si ese producto está por debajo del mínimo se le
|     propone la misma cantidad que propondría la alerta.
|
| `orders` entra para poder descontar lo que ya está pedido a proveedores: sin
| eso, el modo libre sugeriría reponer algo que está por llegar.
|
| El proveedor NO se pide: el backend lo exige (@NotBlank supplier en
| CreateRestockOrderRequest) pero el producto no lo guarda y el diseño no lo
| contempla, así que viaja con este valor fijo hasta que exista el dato.
*/
const SUPPLIER_PLACEHOLDER = "Sin especificar";

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

/*
| De dónde salió la cantidad sugerida. La local es una política de reposición
| por nivel, no una proyección de demanda, y se dice explícitamente para que el
| número no pase por algo que el sistema calculó midiendo consumo.
*/
const suggestionHint = (detail) => {
  if (!detail) return "";
  if (detail.suggestionSource === "backend") {
    return `Stock objetivo ${detail.targetStock} menos la posición de inventario ${detail.inventoryPosition} (disponible ${detail.availableStock} + en tránsito ${detail.onOrderStock}). La calcula el backend sobre la demanda.`;
  }
  if (!(detail.suggestedQuantity > 0)) {
    return `La posición de inventario (${detail.inventoryPosition}) ya cubre el stock mínimo de ${detail.minimumStock}: no hace falta reponer.`;
  }
  const tope =
    detail.maxQuantityPerOrder > 0
      ? ` Limitada al máximo por orden del producto (${detail.maxQuantityPerOrder}).`
      : "";
  return `Repone hasta ${detail.targetStock}, el doble del mínimo de ${detail.minimumStock}, descontando la posición de inventario ${detail.inventoryPosition} (disponible ${detail.availableStock} + en camino ${detail.onOrderStock}).${tope} No es una proyección de demanda.`;
};

export default function RestockOrderModal({
  open,
  alert,
  products = [],
  orders = [],
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
      alert?.suggestedQuantity > 0 ? String(alert.suggestedQuantity) : ""
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

  const onOrderByProduct = useMemo(() => buildOnOrderStock(orders), [orders]);

  // Los números que se muestran: los de la alerta, o los del producto elegido.
  const detail = useMemo(() => {
    if (fromAlert) return alert;
    const product = products.find((p) => p.id === productId);
    return toRestockAlert(product, onOrderByProduct.get(productId) || 0);
  }, [fromAlert, alert, products, productId, onOrderByProduct]);

  const quantityNumber = Number(quantity) || 0;
  const canSubmit = !submitting && Boolean(productId) && quantityNumber > 0;

  // Hay algo que confirmar sólo si la sugerencia es mayor a cero: un producto
  // con stock de sobra sugiere 0, y ahí la cantidad la tiene que poner el
  // operador o el formulario quedaría trabado (canSubmit exige > 0).
  const hasSuggestion = detail?.suggestedQuantity != null && detail.suggestedQuantity > 0;

  // El campo de cantidad aparece siempre que no haya una sugerencia cerrada que
  // confirmar: en el modo libre, desde una alerta sin cantidad, y también
  // cuando la sugerencia la calculamos nosotros.
  //
  // Esto último es a propósito: la sugerencia local es una política de
  // reposición por nivel, no una lectura de la demanda, así que el operador
  // tiene que poder corregirla sin salir del modal. La del backend sí se
  // confirma tal cual, como estaba.
  const asksQuantity =
    !fromAlert || !hasSuggestion || detail?.suggestionSource === "local";

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
          asksQuantity ? (
            <>
              La cantidad viene sugerida según los niveles de stock.{" "}
              <strong>Confirmala o poné otra.</strong>
            </>
          ) : (
            <>
              Se generará una orden de restock con el producto y{" "}
              <strong>la cantidad sugerida por el sistema</strong>.
            </>
          )
        ) : fromAlert ? (
          <>
            Indicá cuánto querés solicitar de este producto.{" "}
            <strong>
              {detail?.onOrderStock > 0
                ? `Ya hay ${units(detail.onOrderStock)} pedidas sin recibir, así que no se sugiere pedir más.`
                : "No hace falta reponer según los niveles configurados."}
            </strong>
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
                ? `Sugerencia: ${units(detail.suggestedQuantity)}. Podés cambiarla.`
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
              title={suggestionHint(detail)}
            >
              {hasSuggestion ? units(detail.suggestedQuantity) : "Sin sugerencia"}
              <Icon name="info" size={14} />
            </strong>
          </div>

          {detail.onOrderStock > 0 && (
            <div className="restock-modal__stat">
              <span className="restock-modal__stat-head">
                <Icon name="truck" size={14} />
                Ya pedido
              </span>
              <strong
                className="restock-modal__stat-value"
                title="Unidades de órdenes de restock abiertas, todavía sin recibir. Ya están descontadas de la sugerencia."
              >
                {units(detail.onOrderStock)}
              </strong>
            </div>
          )}
        </div>
      )}

      {fromAlert && hasSuggestion && (
        <div className="restock-modal__note">
          <Icon name="info" size={16} />
          <span>
            {detail.suggestionSource === "backend"
              ? "Se generará la orden con la cantidad sugerida por el backend."
              : `Cantidad calculada para dejar el stock en ${detail.targetStock} unidades. Ajustala si hace falta.`}
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
