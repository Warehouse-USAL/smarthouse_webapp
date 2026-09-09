import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Badge from "../../ui/Badge/Badge";
import Icon from "../../ui/Icon/Icon";
import { restockService } from "../../../services/restockService";
import { productService } from "../../../services/productService";
import "./RemitoModal.css";

const DELIVERY_UNIT_OPTIONS = [
  { value: "pallet", label: "Pallet" },
  { value: "medio-pallet", label: "Medio pallet" },
  { value: "caja", label: "Caja" },
];

const EMPTY = { order: "", received: "", unit: "" };

const STATUS_META = {
  pendiente: { label: "Pendiente", variant: "warning" },
  recibido: { label: "Recibido parcial", variant: "info" },
};

export default function RemitoModal({ open, onClose }) {
  const [values, setValues] = useState(EMPTY);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(EMPTY);
      setOrdersError(null);

      let cancelled = false;
      setLoadingOrders(true);

      // Órdenes de restock reales, enriquecidas con producto (name/sku) y lo
      // recibido hasta ahora; se descartan las completadas. El modal NO crea la
      // recepción (flujo webapp: la recepción se registra sin ubicación).
      (async () => {
        try {
          const all = [];
          let currentPage = 0;
          const size = 100;
          let totalPages = 1;
          do {
            const res = await restockService.listOrders({ page: currentPage, size });
            all.push(...res.orders);
            totalPages = Math.max(1, res.pagination?.totalPages ?? 1);
            currentPage += 1;
          } while (currentPage < totalPages);

          const productIds = [
            ...new Set(all.map((o) => o.productId).filter(Boolean)),
          ];
          const productEntries = await Promise.all(
            productIds.map(async (id) => [id, await productService.get(id)])
          );
          const productById = new Map(productEntries);

          const detailEntries = await Promise.all(
            all.map(async (o) => [o.id, await restockService.getOrder(o.id)])
          );
          const detailById = new Map(detailEntries);

          const enriched = all
            .map((order) => {
              const received = detailById.get(order.id)?.quantityReceivedSoFar ?? 0;
              const product = productById.get(order.productId);
              return {
                ...order,
                product: product?.name ?? "Producto",
                sku: product?.sku ?? "—",
                received,
                status:
                  received >= order.quantityRequested
                    ? "completado"
                    : received > 0
                      ? "recibido"
                      : "pendiente",
              };
            })
            .filter((order) => order.status !== "completado");

          if (!cancelled) setOrders(enriched);
        } catch (err) {
          if (cancelled) return;
          setOrders([]);
          setOrdersError(
            err?.response?.data?.error?.message ||
              "No pudimos cargar las órdenes de restock."
          );
        } finally {
          if (!cancelled) setLoadingOrders(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [open]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const orderOptions = orders.map((order) => ({
    value: order.id,
    label: `${order.id} · ${order.product} · ${order.quantityRequested} u · ${order.supplier}`,
  }));

  const selectedOrder = orders.find((o) => o.id === values.order) || null;

  const placeholder = loadingOrders
    ? "Cargando órdenes…"
    : orders.length === 0
      ? "No hay órdenes pendientes"
      : "Seleccioná una orden";

  const discrepancy =
    (Number(values.received) || 0) - (selectedOrder?.quantityRequested || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo remito de recepción"
      size="lg"
      footer={
        <div className="remito-modal__footer">
          <div className="remito-modal__footer-left">
            <Button
              variant="danger-outline"
              iconLeft={<Icon name="x" size={16} />}
            >
              Rechazar pedido
            </Button>

          </div>
          <div className="remito-modal__footer-right">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button iconLeft={<Icon name="check" size={16} />}>
              Aceptar pedido
            </Button>
          </div>
        </div>
      }
    >
      <p className="remito-modal__subtitle">
        Completá la información para registrar la recepción de mercadería.
      </p>

      <div className="remito-modal__form">
        {/* ── Sección 1: Orden ─────────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">1</span>
            Seleccioná la orden de restock
          </h4>
          <Select
            placeholder={placeholder}
            options={orderOptions}
            value={values.order}
            onChange={set("order")}
            disabled={loadingOrders || orders.length === 0}
          />
          {ordersError && (
            <span className="remito-modal__field-hint remito-modal__status--error">
              {ordersError}
            </span>
          )}
          {selectedOrder && (
            <div className="remito-modal__info">
              <Badge variant={STATUS_META[selectedOrder.status].variant} dot>
                {STATUS_META[selectedOrder.status].label}
              </Badge>
              <span>
                Cantidad solicitada:{" "}
                <strong>{selectedOrder.quantityRequested} unidades</strong>
              </span>
            </div>
          )}
        </section>

        {/* ── Sección 2: Producto ──────────────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">2</span>
            Producto
          </h4>
          <div className="remito-modal__product-card">
            <div className="remito-modal__product-thumb">
              <Icon name="box" size={24} />
            </div>
            <div className="remito-modal__product-info">
              <span className="remito-modal__product-name">
                {selectedOrder ? selectedOrder.product : "—"}
              </span>
              <span className="remito-modal__product-sku">
                {selectedOrder ? `SKU: ${selectedOrder.sku}` : "Seleccioná una orden"}
              </span>
            </div>
          </div>
        </section>

        {/* ── Sección 3 + 4 + 5: Cantidades ──────────────── */}
        <div className="remito-modal__row">
          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">3</span>
              Cantidad solicitada
            </h4>
            <Input
              type="number"
              value={selectedOrder ? selectedOrder.quantityRequested : ""}
              disabled
              hint="Extraída de la orden"
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">4</span>
              Cantidad recibida
            </h4>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Ej. 50"
              hint="Unidades"
              value={values.received}
              onChange={set("received")}
              required
            />
          </section>

          <section className="remito-modal__section">
            <h4 className="remito-modal__section-title">
              <span className="remito-modal__section-num">5</span>
              Discrepancia
            </h4>
            <Input
              type="number"
              value={discrepancy}
              disabled
              hint="Recibida − Solicitada"
            />
          </section>
        </div>

        {/* ── Info box: discrepancia ───────────────────────── */}
        <div className="remito-modal__info-box">
          <Icon name="info" size={20} color="var(--color-info-blue)" />
          <p>
            La discrepancia se calcula como: <strong>cantidad recibida − cantidad solicitada</strong>.
            <br />
            Un valor negativo indica que llegó menos de lo solicitado.
          </p>
        </div>

        {/* ── Sección 6: Unidad de entrega ─────────────────── */}
        <section className="remito-modal__section">
          <h4 className="remito-modal__section-title">
            <span className="remito-modal__section-num">6</span>
            Unidad de entrega
          </h4>
          <Select
            options={DELIVERY_UNIT_OPTIONS}
            placeholder="Seleccioná una unidad"
            value={values.unit}
            onChange={set("unit")}
            required
          />
          <span className="remito-modal__field-hint">Ej. Pallet, Medio Pallet, Caja</span>
        </section>
      </div>
    </Modal>
  );
}