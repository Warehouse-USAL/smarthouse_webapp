import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card from "../../components/ui/Card/Card";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import DateRangeFilter from "../../components/ui/DateRangeFilter/DateRangeFilter";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import Pagination from "../../components/ui/Pagination/Pagination";
import Spinner from "../../components/ui/Spinner/Spinner";
import StatusBanner from "../../components/ui/StatusBanner/StatusBanner";
import Icon from "../../components/ui/Icon/Icon";
import RestockOrderModal from "../../components/stock/RestockOrderModal/RestockOrderModal";
import RemitoModal from "../../components/stock/RemitoModal/RemitoModal";
import LocateReceptionModal from "../../components/stock/LocateReceptionModal/LocateReceptionModal";
import { productService } from "../../services/productService";
import { restockService } from "../../services/restockService";
import { buildRestockAlerts } from "../../lib/restockSuggestion";
import { STORAGE_UNIT_LABEL } from "../../lib/storageCompatibility";
import "./StockManagementPage.css";

/*
| La pantalla tiene dos mitades que se alimentan de fuentes distintas:
|
|   · Izquierda — "Productos con alerta de reestock": sale de
|     POST /metrics/restock-suggestions (rama feature/metrics-endpoints). Si ese
|     endpoint todavía no está desplegado, se cae a derivar la alerta de
|     GET /products con el mismo umbral que usa el backend (stock < mínimo) y la
|     columna de sugerencia queda vacía — no se inventa la cantidad.
|
|   · Derecha — "Órdenes de restock": GET /restock/orders + GET /restock/receptions,
|     compuestos en restockService.listOrdersWithProgress (el listado de órdenes
|     no trae ni lo recibido ni el estado; se derivan de las recepciones).
|
| El flujo completo es: alerta → orden de restock → remito de recepción → stock.
*/

const ACTION_CARDS = [
  {
    key: "restock",
    icon: "box",
    title: "Agregar órdenes de restock",
    description: "Creá órdenes para solicitar mercadería a tus proveedores.",
    note: "La orden quedará pendiente hasta que se registre el remito de entrega.",
    variant: "yellow",
  },
  {
    key: "receiving",
    icon: "truck",
    title: "Agregar remitos de recepción",
    description: "Registrá los remitos de entrega recibidos de tus proveedores.",
    note: "Al confirmar la recepción, el stock se actualizará automáticamente.",
    variant: "blue",
  },
];

// El backend NO persiste `status` en RestockOrder (RFC §9): los tres estados se
// derivan de cuánto se recibió contra lo solicitado. Por eso no hay
// "Cancelado": no existe forma de llegar a ese estado hoy.
const STATUS_META = {
  pendiente: { label: "Pendiente", plural: "Pendientes", variant: "warning" },
  recibido: { label: "Recibido", plural: "Recibidos", variant: "info" },
  completado: { label: "Completado", plural: "Completados", variant: "success" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const PAGE_SIZE_OPTIONS = [
  { value: "5", label: "5 por página" },
  { value: "10", label: "10 por página" },
  { value: "20", label: "20 por página" },
];

const ALERTS_PAGE_SIZE = 5;

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR") : "—";

const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const isoDay = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

export default function StockManagementPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  // false = el endpoint de sugerencias no está disponible todavía y la lista se
  // derivó localmente, sin cantidad sugerida.
  const [suggestionsFromBackend, setSuggestionsFromBackend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // null = cerrado. { alert } = precargado desde una alerta; {} = form vacío.
  const [orderModal, setOrderModal] = useState(null);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [locateOpen, setLocateOpen] = useState(false);
  // Remitos ya recibidos con mercadería todavía sin posición. Solo existen si el
  // backend soporta PENDING_LOCATION (rama feature/117).
  const [pendingLocation, setPendingLocation] = useState([]);
  const [detail, setDetail] = useState(null);
  // GET /restock/orders/:id devuelve quantity_received_so_far calculado por el
  // backend. El listado no lo trae, así que en la tabla se agrega desde los
  // remitos; al abrir el detalle se pide el número autoritativo.
  const [detailReceived, setDetailReceived] = useState(null);

  // Panel de alertas
  const [alertSearch, setAlertSearch] = useState("");
  const [alertCategory, setAlertCategory] = useState("");
  const [alertFiltersOpen, setAlertFiltersOpen] = useState(false);
  const [alertPage, setAlertPage] = useState(1);

  // Panel de órdenes
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderRange, setOrderRange] = useState({ from: "", to: "" });
  const [orderFiltersOpen, setOrderFiltersOpen] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(5);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productList, orderList] = await Promise.all([
        // listAll, no list: `list` trae una sola página de 50 y el cruce con
        // órdenes y alertas necesita el catálogo entero.
        productService.listAll({ isActive: true }),
        restockService.listOrdersWithProgress(),
      ]);
      setProducts(productList);

      // Las sugerencias las calcula el backend. `null` significa que el
      // endpoint todavía no existe: ahí se listan las alertas por el umbral de
      // stock mínimo y la cantidad queda a cargo del operador.
      const suggested = await restockService.listAlerts(productList);
      setSuggestionsFromBackend(suggested !== null);
      setAlerts(suggested ?? buildRestockAlerts(productList));

      setPendingLocation(await restockService.listPendingLocation());

      // Más reciente primero, como en el diseño.
      setOrders(
        [...orderList].sort(
          (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
        )
      );
    } catch {
      setLoadError(
        "No se pudo cargar la gestión de stock. Revisá la conexión con el backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial contra el backend
    load();
  }, [load]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  /* ---------- Panel de alertas ---------- */

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Todas las categorías" },
      ...[...new Set(alerts.map((a) => a.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((category) => ({ value: category, label: category })),
    ],
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    const q = alertSearch.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (alertCategory && alert.category !== alertCategory) return false;
      if (!q) return true;
      return (
        alert.name.toLowerCase().includes(q) ||
        (alert.sku || "").toLowerCase().includes(q)
      );
    });
  }, [alerts, alertSearch, alertCategory]);

  const alertTotalPages = Math.max(
    1,
    Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE)
  );
  const alertStart = (Math.min(alertPage, alertTotalPages) - 1) * ALERTS_PAGE_SIZE;
  const alertItems = filteredAlerts.slice(alertStart, alertStart + ALERTS_PAGE_SIZE);

  /* ---------- Panel de órdenes ---------- */

  // Se resuelve el producto de cada orden acá (el backend devuelve solo el id).
  const decoratedOrders = useMemo(
    () =>
      orders.map((order) => {
        const product = productById.get(order.productId);
        return {
          ...order,
          productName: product?.name ?? "Producto dado de baja",
          sku: product?.sku ?? order.productId,
          imageUrl: product?.imageUrl ?? "",
        };
      }),
    [orders, productById]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return decoratedOrders.filter((order) => {
      if (orderStatus && order.status !== orderStatus) return false;
      const day = isoDay(order.createdAt);
      if (orderRange.from && day < orderRange.from) return false;
      if (orderRange.to && day > orderRange.to) return false;
      if (!q) return true;
      return (
        order.productName.toLowerCase().includes(q) ||
        (order.sku || "").toLowerCase().includes(q) ||
        (order.code || "").toLowerCase().includes(q)
      );
    });
  }, [decoratedOrders, orderSearch, orderStatus, orderRange]);

  const orderTotalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / orderPageSize)
  );
  const orderStart = (Math.min(orderPage, orderTotalPages) - 1) * orderPageSize;
  const orderItems = filteredOrders.slice(orderStart, orderStart + orderPageSize);

  /* ---------- Acciones ---------- */

  const handleActionCard = (key) => {
    // La tarjeta abre el formulario en blanco: acá todavía no se eligió ni
    // producto ni cantidad. Precargado se entra por el botón de cada alerta.
    if (key === "restock") setOrderModal({});
    if (key === "receiving") setReceivingOpen(true);
  };

  const handleOrderCreated = async () => {
    setFeedback({ type: "ok", text: "Orden de restock creada correctamente." });
    await load();
  };

  const handleReceptionCreated = async (reception) => {
    setFeedback({
      type: "ok",
      text:
        reception?.quantityPendingLocation > 0
          ? `Remito registrado con ${reception.quantityPendingLocation} unidades sin ubicar. Asignales posición cuando quieras.`
          : "Remito registrado. El stock de las posiciones se actualizó.",
    });
    await load();
  };

  const handleLocated = async () => {
    setFeedback({
      type: "ok",
      text: "Posiciones asignadas. El stock del warehouse se actualizó.",
    });
    await load();
  };

  // Qué orden está abierta ahora mismo: una respuesta que llega tarde, después
  // de que el usuario abrió otra orden o cerró el modal, se descarta.
  const openDetailId = useRef(null);

  const openDetail = (order) => {
    setDetail(order);
    setDetailReceived(null);
    openDetailId.current = order.id;
    restockService
      .getOrder(order.id)
      .then((full) => {
        if (openDetailId.current !== order.id) return;
        setDetailReceived(full?.quantityReceivedSoFar ?? null);
      })
      .catch(() => {
        /* se sigue mostrando lo agregado desde los remitos */
      });
  };

  const closeDetail = () => {
    openDetailId.current = null;
    setDetail(null);
    setDetailReceived(null);
  };

  const detailProduct = detail ? productById.get(detail.productId) : null;

  return (
    <div className="stock-management">
      <PageHeader
        title="Gestión de stock"
        subtitle="Gestioná tus órdenes de restock y registrá las recepciones de mercadería para mantener tu stock actualizado."
      />

      {feedback && (
        <StatusBanner
          statusBannerState={
            feedback.type === "ok" ? "status-banner-exito" : "status-banner"
          }
          icon={<Icon name={feedback.type === "ok" ? "check" : "info"} size={16} />}
          text={feedback.text}
        />
      )}

      {loadError && (
        <StatusBanner
          statusBannerState="status-banner-error"
          icon={<Icon name="alert" size={16} />}
          text={loadError}
        />
      )}

      <div className="stock-management__actions">
        {ACTION_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`stock-management__card stock-management__card--${card.variant}`}
            onClick={() => handleActionCard(card.key)}
          >
            <div className="stock-management__card-icon">
              <Icon name={card.icon} size={22} color="currentColor" />
            </div>
            <div className="stock-management__card-body">
              <h3 className="stock-management__card-title">{card.title}</h3>
              <p className="stock-management__card-desc">
                {card.description}
                <br />
                {card.note}
              </p>
            </div>
            <Icon
              name="chevronRight"
              size={18}
              className="stock-management__card-chevron"
            />
          </button>
        ))}
      </div>

      {pendingLocation.length > 0 && (
        <div className="stock-management__pending">
          <span className="stock-management__pending-icon">
            <Icon name="pin" size={20} />
          </span>
          <div className="stock-management__pending-text">
            <strong>
              {pendingLocation.length} remito
              {pendingLocation.length === 1 ? "" : "s"} pendiente
              {pendingLocation.length === 1 ? "" : "s"} de ubicación
            </strong>
            <span>
              Mercadería ya recibida que todavía no tiene posición asignada en el
              warehouse.
            </span>
          </div>
          <Button variant="secondary" onClick={() => setLocateOpen(true)}>
            Ubicar mercadería
          </Button>
        </div>
      )}

      <div className="stock-management__grid">
        {/* ═══ Productos con alerta de reestock ═══════════════ */}
        <Card padding="none" className="stock-panel">
          <header className="stock-panel__head">
            <h3 className="stock-panel__title">
              Productos con alerta de reestock
              <span className="stock-panel__count">({filteredAlerts.length})</span>
              <span
                className="stock-panel__hint"
                title={
                  suggestionsFromBackend
                    ? "El backend compara la posición de inventario (disponible + en tránsito) contra el punto de reposición calculado sobre la demanda."
                    : "Un producto entra en alerta cuando su stock disponible queda por debajo del mínimo configurado."
                }
              >
                <Icon name="info" size={15} />
              </span>
            </h3>
            <p className="stock-panel__desc">
              {suggestionsFromBackend
                ? "Cantidades sugeridas por el backend según demanda, stock de seguridad y mercadería en tránsito."
                : "Productos que necesitan ser reabastecidos según niveles mínimos de stock."}
            </p>
            {!suggestionsFromBackend && !loading && alerts.length > 0 && (
              <p className="stock-panel__warning">
                <Icon name="info" size={14} />
                El cálculo de cantidad sugerida todavía no está disponible en el
                backend: al crear la orden, indicá vos la cantidad.
              </p>
            )}
          </header>

          <div className="stock-panel__toolbar">
            <Input
              placeholder="Buscar por nombre o SKU"
              value={alertSearch}
              onChange={(e) => {
                setAlertSearch(e.target.value);
                setAlertPage(1);
              }}
              iconLeft={<Icon name="search" size={16} />}
            />
            <button
              type="button"
              className={`stock-panel__filters-btn ${
                alertFiltersOpen ? "stock-panel__filters-btn--on" : ""
              }`}
              onClick={() => setAlertFiltersOpen((v) => !v)}
            >
              <Icon name="filter" size={16} />
              Filtros
            </button>
          </div>

          {alertFiltersOpen && (
            <div className="stock-panel__filters">
              <Select
                label="Categoría"
                value={alertCategory}
                onChange={(e) => {
                  setAlertCategory(e.target.value);
                  setAlertPage(1);
                }}
                options={categoryOptions}
              />
            </div>
          )}

          {loading ? (
            <div className="stock-panel__loading">
              <Spinner size={28} label="Cargando productos…" />
            </div>
          ) : alertItems.length === 0 ? (
            <EmptyState
              icon="check"
              title="Sin alertas de reestock"
              description="Ningún producto está por debajo de su stock mínimo."
            />
          ) : (
            <div className="stock-table-wrap">
              <table className="stock-table stock-table--wrap-head">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>{alertItems[0]?.thresholdLabel ?? "Stock mínimo"}</th>
                    <th>Sugerencia</th>
                    <th className="stock-table__actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alertItems.map((alert) => (
                    <tr key={alert.productId}>
                      <td>
                        <div className="stock-table__product">
                          <span className="stock-table__thumb">
                            <Icon name="box" size={18} />
                            {alert.imageUrl && (
                              <img src={alert.imageUrl} alt="" loading="lazy" />
                            )}
                          </span>
                          <span className="stock-table__product-text">
                            <span
                              className="stock-table__product-name"
                              title={alert.name}
                            >
                              {alert.name}
                            </span>
                            <span className="stock-table__product-sku">
                              {alert.sku}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="stock-table__num stock-table__num--low">
                        {alert.availableStock}
                      </td>
                      <td className="stock-table__num">{alert.threshold}</td>
                      <td className="stock-table__num stock-table__num--suggested">
                        {alert.suggestedQuantity ?? (
                          <span
                            className="stock-table__num--unknown"
                            title="La calcula el backend (POST /metrics/restock-suggestions). Todavía no está disponible: la cantidad se define al crear la orden."
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          iconLeft={<Icon name="cart" size={15} />}
                          onClick={() => setOrderModal({ alert })}
                        >
                          Orden de Restock
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAlerts.length > 0 && (
            <footer className="stock-panel__foot">
              <span className="stock-panel__showing">
                Mostrando {alertStart + 1} a{" "}
                {Math.min(alertStart + ALERTS_PAGE_SIZE, filteredAlerts.length)} de{" "}
                {filteredAlerts.length} productos
              </span>
              <Pagination
                current={Math.min(alertPage, alertTotalPages)}
                total={alertTotalPages}
                onChange={setAlertPage}
              />
            </footer>
          )}
        </Card>

        {/* ═══ Órdenes de restock ═════════════════════════════ */}
        <Card padding="none" className="stock-panel">
          <header className="stock-panel__head">
            <h3 className="stock-panel__title">
              Órdenes de restock
              <span className="stock-panel__count">({filteredOrders.length})</span>
              <span
                className="stock-panel__hint"
                title="El estado se deriva de las recepciones registradas: sin recibir (pendiente), parcial (recibido) o completo."
              >
                <Icon name="info" size={15} />
              </span>
            </h3>
            <p className="stock-panel__desc">
              Gestioná el estado de tus órdenes de restock y registrá las
              recepciones.
            </p>
          </header>

          <div className="stock-panel__toolbar">
            <Input
              placeholder="Buscar por producto, SKU u orden"
              value={orderSearch}
              onChange={(e) => {
                setOrderSearch(e.target.value);
                setOrderPage(1);
              }}
              iconLeft={<Icon name="search" size={16} />}
            />
            <button
              type="button"
              className={`stock-panel__filters-btn ${
                orderFiltersOpen ? "stock-panel__filters-btn--on" : ""
              }`}
              onClick={() => setOrderFiltersOpen((v) => !v)}
            >
              <Icon name="filter" size={16} />
              Filtros
            </button>
          </div>

          {orderFiltersOpen && (
            <div className="stock-panel__filters stock-panel__filters--wide">
              <Select
                label="Estado"
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value);
                  setOrderPage(1);
                }}
                options={STATUS_OPTIONS}
              />
              <DateRangeFilter
                label="Fecha de creación"
                value={orderRange}
                onChange={(next) => {
                  setOrderRange(next);
                  setOrderPage(1);
                }}
              />
            </div>
          )}

          {loading ? (
            <div className="stock-panel__loading">
              <Spinner size={28} label="Cargando órdenes…" />
            </div>
          ) : orderItems.length === 0 ? (
            <EmptyState
              icon="box"
              title="No hay órdenes"
              description="No encontramos órdenes de restock con los filtros seleccionados."
            />
          ) : (
            <div className="stock-table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Orden (RST)</th>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Solicitado</th>
                    <th>Recibido</th>
                    <th>Unidad</th>
                    <th>Estado</th>
                    <th className="stock-table__actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((order) => (
                    <tr key={order.id}>
                      <td className="stock-table__order">{order.code}</td>
                      <td className="stock-table__date">
                        {formatDate(order.createdAt)}
                      </td>
                      <td>
                        <div className="stock-table__product">
                          <span className="stock-table__thumb">
                            <Icon name="box" size={18} />
                            {order.imageUrl && (
                              <img src={order.imageUrl} alt="" loading="lazy" />
                            )}
                          </span>
                          <span className="stock-table__product-text">
                            <span
                              className="stock-table__product-name"
                              title={order.productName}
                            >
                              {order.productName}
                            </span>
                            <span className="stock-table__product-sku">
                              {order.sku}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="stock-table__num">{order.quantityRequested}</td>
                      <td className="stock-table__num">{order.quantityReceived}</td>
                      <td>
                        {order.deliveryUnit
                          ? STORAGE_UNIT_LABEL[order.deliveryUnit] ?? "Mixta"
                          : "—"}
                      </td>
                      <td>
                        <Badge variant={STATUS_META[order.status].variant} dot>
                          {STATUS_META[order.status].label}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="stock-table__detail"
                          onClick={() => openDetail(order)}
                        >
                          Ver detalle
                          <Icon name="chevronRight" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredOrders.length > 0 && (
            <footer className="stock-panel__foot">
              <span className="stock-panel__showing">
                Mostrando {orderStart + 1} a{" "}
                {Math.min(orderStart + orderPageSize, filteredOrders.length)} de{" "}
                {filteredOrders.length} órdenes
              </span>
              <Pagination
                current={Math.min(orderPage, orderTotalPages)}
                total={orderTotalPages}
                onChange={setOrderPage}
              />
              <Select
                value={String(orderPageSize)}
                onChange={(e) => {
                  setOrderPageSize(Number(e.target.value));
                  setOrderPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
            </footer>
          )}
        </Card>
      </div>

      <RestockOrderModal
        open={orderModal !== null}
        alert={orderModal?.alert ?? null}
        products={products}
        onClose={() => setOrderModal(null)}
        onCreated={handleOrderCreated}
      />

      <LocateReceptionModal
        open={locateOpen}
        receptions={pendingLocation}
        products={products}
        onClose={() => setLocateOpen(false)}
        onLocated={handleLocated}
      />

      <RemitoModal
        open={receivingOpen}
        orders={decoratedOrders}
        products={products}
        onClose={() => setReceivingOpen(false)}
        onCreated={handleReceptionCreated}
      />

      <Modal
        open={detail !== null}
        onClose={closeDetail}
        title={detail ? `Orden ${detail.code}` : ""}
        size="sm"
        footer={
          <Button variant="secondary" onClick={closeDetail}>
            Cerrar
          </Button>
        }
      >
        {detail && (
          <>
            <dl className="stock-management__detail">
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge variant={STATUS_META[detail.status].variant} dot>
                    {STATUS_META[detail.status].label}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>Producto</dt>
                <dd>{detail.productName}</dd>
              </div>
              <div>
                <dt>SKU</dt>
                <dd>{detail.sku}</dd>
              </div>
              <div>
                <dt>Proveedor</dt>
                <dd>{detail.supplier || "—"}</dd>
              </div>
              <div>
                <dt>Fecha de creación</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt>Cantidad solicitada</dt>
                <dd>{units(detail.quantityRequested)}</dd>
              </div>
              <div>
                <dt>Recibido</dt>
                <dd>{units(detailReceived ?? detail.quantityReceived)}</dd>
              </div>
              <div>
                <dt>Stock actual del producto</dt>
                <dd>
                  {detailProduct ? units(detailProduct.availableStock) : "—"}
                </dd>
              </div>
            </dl>

            <h4 className="stock-management__detail-title">
              Remitos de esta orden
            </h4>
            {detail.receptions.length === 0 ? (
              <p className="stock-management__detail-empty">
                Todavía no se registró ningún remito para esta orden.
              </p>
            ) : (
              <ul className="stock-management__receptions">
                {detail.receptions.map((reception) => (
                  <li key={reception.id}>
                    <span>{formatDate(reception.createdAt)}</span>
                    <span>{units(reception.quantityReceived)}</span>
                    <span>
                      {STORAGE_UNIT_LABEL[reception.deliveryUnit] ??
                        reception.deliveryUnit}
                    </span>
                    <span>{reception.assignments.length} posición/es</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
