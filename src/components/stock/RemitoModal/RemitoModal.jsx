import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import Spinner from "../../ui/Spinner/Spinner";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import PositionAssigner from "../PositionAssigner/PositionAssigner";
import { restockService } from "../../../services/restockService";
import { errorText } from "../../../lib/apiError";
import { productService } from "../../../services/productService";
import { STORAGE_UNITS, STORAGE_UNIT_LABEL } from "../../../lib/storageCompatibility";
import "./RemitoModal.css";

/*
| El remito es la ÚNICA operación que incrementa stock (RN-04). El backend lo
| registra de forma atómica junto con el reparto entre posiciones:
|
|   POST /restock/receptions { restock_order_id?, product_id, quantity_received,
|                              delivery_unit, supplier, assignments[] }
|
| Dos reglas que condicionan el formulario:
|   · assignments es @NotEmpty y sum(quantity) debe ser == quantity_received
|     (RN-07 / ASSIGNMENT_QUANTITY_MISMATCH). Por eso no se puede guardar un
|     remito "sin ubicar": hay que repartirlo acá mismo.
|   · Las posiciones candidatas las da el backend
|     (GET /warehouse/positions/available), que ya filtra por tamaño == unidad
|     de entrega, posición libre o del mismo producto, y capacidad/volumen.
*/

const DELIVERY_UNIT_OPTIONS = STORAGE_UNITS.map((unit) => ({
  value: unit,
  label: STORAGE_UNIT_LABEL[unit],
}));

const NO_ORDER = "";

// El backend exige supplier (@NotBlank en CreateReceptionRequest) pero el
// diseño no lo pide: se toma el de la orden elegida y, en una recepción sin
// orden, viaja con este marcador.
const SUPPLIER_PLACEHOLDER = "Sin especificar";

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR") : "—";

const STATUS_LABEL = {
  pendiente: { label: "Pendiente", variant: "warning" },
  recibido: { label: "Recibido", variant: "info" },
  completado: { label: "Completado", variant: "success" },
};

export default function RemitoModal({
  open,
  onClose,
  orders = [],
  products = [],
  onCreated,
}) {
  const [orderId, setOrderId] = useState(NO_ORDER);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  // { [positionId]: cantidad } — el reparto que viaja como assignments[].
  const [assignments, setAssignments] = useState({});

  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Solo tiene sentido recibir contra órdenes que todavía esperan mercadería.
  const openOrders = useMemo(
    () => orders.filter((order) => order.status !== "completado"),
    [orders]
  );

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const selectedOrder = useMemo(
    () => openOrders.find((order) => order.id === orderId) || null,
    [openOrders, orderId]
  );

  const product = productById.get(productId) || null;

  const reset = useCallback(() => {
    setOrderId(NO_ORDER);
    setProductId("");
    setQuantity("");
    setUnit("");
    setAssignments({});
    setLocations([]);
    setError(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) reset();
  }, [open, reset]);

  // Elegir una orden fija producto y proveedor, y propone recibir lo que falta.
  const handleOrderChange = (value) => {
    setOrderId(value);
    setAssignments({});
    const order = openOrders.find((o) => o.id === value);
    if (!order) return;
    setProductId(order.productId);
    const pending = Math.max(
      0,
      order.quantityRequested - (order.quantityReceived || 0)
    );
    setQuantity(pending ? String(pending) : "");
  };

  const handleProductChange = (value) => {
    setProductId(value);
    setAssignments({});
  };

  // Ubicaciones donde ya está ese producto hoy (GET /products/:id/location).
  useEffect(() => {
    if (!open || !productId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia la sección al quedarse sin producto
      setLocations([]);
      return;
    }
    let cancelled = false;
    setLoadingLocations(true);
    productService
      .getLocations(productId)
      .then((rows) => {
        if (!cancelled) setLocations(rows);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const quantityNumber = Number(quantity) || 0;

  const assignedTotal = useMemo(
    () => Object.values(assignments).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [assignments]
  );

  const remaining = quantityNumber - assignedTotal;

  // Con la rama feature/117 el backend acepta un remito parcialmente ubicado
  // (lo deja PENDING_LOCATION) y solo rechaza que lo asignado SUPERE lo
  // recibido. Sin esa rama, assignments es @NotEmpty y tiene que cuadrar justo.
  const puedeGuardarSinUbicar = restockService.supportsPendingLocation();

  const repartoValido = puedeGuardarSinUbicar
    ? assignedTotal <= quantityNumber
    : assignedTotal === quantityNumber;

  const canSubmit =
    !submitting &&
    Boolean(productId) &&
    Boolean(unit) &&
    quantityNumber > 0 &&
    repartoValido;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const reception = await restockService.createReception({
        restockOrderId: orderId || null,
        productId,
        quantityReceived: quantityNumber,
        deliveryUnit: unit,
        supplier: selectedOrder?.supplier || SUPPLIER_PLACEHOLDER,
        assignments: Object.entries(assignments).map(([positionId, qty]) => ({
          positionId,
          quantity: qty,
        })),
      });
      onCreated?.(reception);
      onClose?.();
    } catch (e) {
      setError(
        errorText(e, {
          ASSIGNMENT_QUANTITY_MISMATCH:
            "El reparto entre posiciones no coincide con la cantidad recibida.",
          POSITION_ALREADY_OCCUPIED:
            "Alguna de las posiciones elegidas ya tiene otro producto.",
          STOCK_EXCEEDS_CAPACITY:
            "La cantidad asignada supera la capacidad de alguna posición.",
          RESTOCK_ORDER_PRODUCT_MISMATCH:
            "La orden seleccionada corresponde a otro producto.",
          RECEPTION_ALREADY_COMPLETED:
            "Ese remito ya tiene toda su mercadería ubicada.",
          PRODUCT_NOT_FOUND: "El producto no existe o está inactivo.",
        }, "No se pudo registrar el remito. Intentá de nuevo.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const orderOptions = [
    { value: NO_ORDER, label: "Sin orden asociada (recepción directa)" },
    ...openOrders.map((order) => ({
      value: order.id,
      // Identificar la orden por su producto es más útil que por el proveedor,
      // que hoy casi siempre es el marcador.
      label: `${order.code} · ${formatDate(order.createdAt)} · ${
        order.productName ?? order.supplier
      }`,
    })),
  ];

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.sku}`,
  }));

  const locationsTotal = locations.reduce(
    (sum, row) => sum + (row.currentStock || 0),
    0
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo remito de recepción"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? "Guardando…"
              : puedeGuardarSinUbicar && remaining > 0
                ? "Guardar sin ubicar"
                : "Guardar remito"}
          </Button>
        </>
      }
    >
      <p className="remito-modal__subtitle">
        Completá la información para registrar la recepción de mercadería. Al
        confirmar, el stock de las posiciones elegidas se incrementa.
      </p>

      <div className="remito-modal__form">
        {/* ── 1. Orden ─────────────────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">1</span>
            Seleccioná la orden de restock
          </h4>
          <Select
            options={orderOptions}
            value={orderId}
            onChange={(e) => handleOrderChange(e.target.value)}
          />
          {selectedOrder && (
            <div className="remito-modal__info">
              <Badge
                variant={STATUS_LABEL[selectedOrder.status]?.variant}
                dot
              >
                {STATUS_LABEL[selectedOrder.status]?.label}
              </Badge>
              <span>
                Solicitado: <strong>{selectedOrder.quantityRequested}</strong> ·
                Recibido: <strong>{selectedOrder.quantityReceived}</strong> ·
                Pendiente:{" "}
                <strong>
                  {Math.max(
                    0,
                    selectedOrder.quantityRequested -
                      selectedOrder.quantityReceived
                  )}
                </strong>
              </span>
            </div>
          )}
        </section>

        {/* ── 2. Producto ──────────────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">2</span>
            Producto
          </h4>
          {selectedOrder ? (
            <div className="remito-modal__product-card">
              <div className="remito-modal__product-thumb">
                {product?.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} />
                ) : (
                  <Icon name="box" size={24} />
                )}
              </div>
              <div className="remito-modal__product-info">
                <span className="remito-modal__product-name">
                  {product?.name || "Producto de la orden"}
                </span>
                <span className="remito-modal__product-sku">
                  SKU: {product?.sku || productId}
                </span>
              </div>
            </div>
          ) : (
            <Select
              options={productOptions}
              placeholder="Seleccioná el producto recibido"
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
            />
          )}
        </section>

        {/* ── 3 + 4. Cantidad y unidad ─────────────────────── */}
        <div className="remito-modal__row">
          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">3</span>
              Cantidad recibida
            </h4>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Ej. 50"
              hint="Unidades efectivamente recibidas (puede diferir de lo solicitado)."
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">4</span>
              Unidad de entrega
            </h4>
            <Select
              options={DELIVERY_UNIT_OPTIONS}
              placeholder="Seleccioná una unidad"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setAssignments({});
              }}
            />
            <span className="remito-modal__field-hint">
              Define qué posiciones pueden recibir la mercadería.
            </span>
          </section>
        </div>

        {/* ── 5. Ubicación actual ──────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">5</span>
            Ubicación actual del material
          </h4>
          {!productId ? (
            <p className="remito-modal__placeholder">
              Elegí un producto para ver dónde está almacenado hoy.
            </p>
          ) : loadingLocations ? (
            <Spinner size={20} label="Buscando ubicaciones…" />
          ) : locations.length === 0 ? (
            <p className="remito-modal__placeholder">
              El producto todavía no ocupa ninguna posición del warehouse.
            </p>
          ) : (
            <div className="remito-modal__table-wrap">
              <table className="remito-modal__table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Zona</th>
                    <th>Línea</th>
                    <th>Cantidad actual</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((row) => (
                    <tr key={row.idPosition}>
                      <td className="remito-modal__table-loc">
                        {row.positionName}
                      </td>
                      <td>{row.zoneCode ?? "—"}</td>
                      <td>{row.numberLine ?? "—"}</td>
                      <td>{row.currentStock} unidades</td>
                    </tr>
                  ))}
                  <tr className="remito-modal__table-total">
                    <td colSpan={3}>Stock total del producto</td>
                    <td>{locationsTotal} unidades</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 6. Reparto ───────────────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">6</span>
            Ubicaciones disponibles para asignar el material recibido
            {puedeGuardarSinUbicar && (
              <span className="remito-modal__section-optional">opcional</span>
            )}
          </h4>

          <PositionAssigner
            productId={productId}
            deliveryUnit={unit}
            quantity={quantityNumber}
            assignments={assignments}
            onChange={setAssignments}
          />

          {puedeGuardarSinUbicar && remaining > 0 && quantityNumber > 0 && (
            <p className="remito-modal__pending-note">
              <Icon name="info" size={15} />
              Podés guardar el remito con {remaining} unidad
              {remaining === 1 ? "" : "es"} sin ubicar: queda pendiente de
              ubicación y se le asignan posiciones más tarde.
            </p>
          )}
        </section>

        {error && (
          <StatusBanner
            statusBannerState="status-banner-error"
            icon={<Icon name="alert" size={16} />}
            text={error}
          />
        )}
      </div>
    </Modal>
  );
}
