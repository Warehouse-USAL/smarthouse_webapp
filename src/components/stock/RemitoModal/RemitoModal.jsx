import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import Spinner from "../../ui/Spinner/Spinner";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import ProductSummaryCard from "../ProductSummaryCard/ProductSummaryCard";
import { restockService } from "../../../services/restockService";
import { errorText } from "../../../lib/apiError";
import { productService } from "../../../services/productService";
import { STORAGE_UNITS, STORAGE_UNIT_LABEL } from "../../../lib/storageCompatibility";
import "./RemitoModal.css";

/*
| El remito es la ÚNICA operación que incrementa stock (RN-04):
|
|   POST /restock/receptions { restock_order_id?, product_id, quantity_received,
|                              delivery_unit, supplier, assignments: [] }
|
| Acá solo se registra lo recibido: se manda sin posiciones, así que el remito
| nace PENDING_LOCATION y la mercadería se ubica después desde Asignación de
| ubicación (PATCH /restock/receptions/:id). Recién ahí suma stock.
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
  recibido_parcial: { label: "Recibido parcial", variant: "info" },
  recibido: { label: "Recibido", variant: "success" },
};

export default function RemitoModal({
  open,
  onClose,
  products = [],
  onCreated,
}) {
  const [orderId, setOrderId] = useState(NO_ORDER);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Solo tiene sentido recibir contra órdenes que todavía esperan mercadería.
  // null = cargando o sin abrir; { orders, error } = respuesta de la última apertura.
  const [openOrdersResult, setOpenOrdersResult] = useState(null);
  const openOrders = useMemo(() => openOrdersResult?.orders ?? [], [openOrdersResult]);

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
    setLocations([]);
    setError(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) reset();
  }, [open, reset]);

  // Si no cargan, el remito se puede registrar igual sin orden asociada.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    restockService
      .listOpenOrders()
      .then((orders) => ({ orders, error: null }))
      .catch((e) => ({
        orders: [],
        error: errorText(
          e,
          {},
          "No se pudieron cargar las órdenes abiertas. Podés registrar el remito sin orden asociada."
        ),
      }))
      .then((result) => {
        if (!stale) setOpenOrdersResult(result);
      });
    return () => {
      stale = true;
      setOpenOrdersResult(null);
    };
  }, [open]);

  // Elegir una orden fija producto y proveedor, y propone recibir lo que falta.
  const handleOrderChange = (value) => {
    setOrderId(value);
    const order = openOrders.find((o) => o.id === value);
    // "Sin orden asociada": hay que soltar también el producto y la cantidad.
    // Dejándolos puestos, el remito directo se enviaba con los datos de la
    // orden anterior aunque el selector ya estuviera vacío.
    if (!order) {
      setProductId("");
      setQuantity("");
      return;
    }
    setProductId(order.productId);
    const pending = Math.max(
      0,
      order.quantityRequested - (order.quantityReceived || 0)
    );
    setQuantity(pending ? String(pending) : "");
  };

  const handleProductChange = (value) => {
    setProductId(value);
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

  const canSubmit =
    !submitting && Boolean(productId) && Boolean(unit) && quantityNumber > 0;

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
        assignments: [],
      });
      onCreated?.(reception);
      onClose?.();
    } catch (e) {
      setError(
        errorText(e, {
          RESTOCK_ORDER_PRODUCT_MISMATCH:
            "La orden seleccionada corresponde a otro producto.",
          PRODUCT_NOT_FOUND: "El producto no existe o está inactivo.",
          RESTOCK_ORDER_NOT_FOUND: "La orden de restock no existe.",
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
        productById.get(order.productId)?.name ?? order.supplier
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
      subtitle="Registrá la mercadería recibida. Queda pendiente de ubicación y suma stock cuando la ubicás desde Asignación de ubicación."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Guardando…" : "Guardar remito"}
          </Button>
        </>
      }
    >
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
            disabled={openOrdersResult === null}
          />
          <span className="remito-modal__field-hint">
            "Sin orden asociada" es para mercadería que llega sin una orden de
            restock previa: por ejemplo, el stock inicial de un producto que ya
            estaba en el depósito o una entrega no planificada.
          </span>
          {openOrdersResult?.error && (
            <StatusBanner
              statusBannerState="status-banner"
              icon={<Icon name="info" size={16} />}
              text={openOrdersResult.error}
            />
          )}
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
            <ProductSummaryCard
              imageUrl={product?.imageUrl}
              name={product?.name || "Producto de la orden"}
              sku={product?.sku || productId}
              category={product?.category}
              metrics={
                product
                  ? [
                      {
                        icon: "box",
                        label: "Stock actual",
                        value: `${product.availableStock ?? 0} unidades`,
                      },
                      {
                        icon: "alert",
                        label: "Punto de reposición",
                        value:
                          product.reorderPoint != null
                            ? `${product.reorderPoint} unidades`
                            : "Sin calcular",
                      },
                    ]
                  : []
              }
            />
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
              onChange={(e) => setUnit(e.target.value)}
            />
            <span className="remito-modal__field-hint">
              Define qué posiciones pueden recibir la mercadería al ubicarla.
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
