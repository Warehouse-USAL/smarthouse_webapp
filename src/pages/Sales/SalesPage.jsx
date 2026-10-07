import { useCallback, useEffect, useMemo, useState } from "react";
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
import { orderService, mapOrderStatus } from "../../services/orderService";
import { productService } from "../../services/productService";
import { userService } from "../../services/userService";
import "./SalesPage.css";

/*
| Gestión de Ventas (Order = despacho al cliente, NO confundir con restock).
|
| El backend NO tiene despacho manual: la orden la completan los rovers vía
| Central (in_progress → completed). "Marcar como despachado" abre la
| confirmación y ahí se informa que todavía no se puede hacer a mano.
| Cancelar sí existe (POST /orders/:id/cancel) y funciona de verdad.
|
| Cliente: Order solo trae requested_by_user_id. Se cruza con userService
| cuando el rol lo permite (requiere admin_system); si no, "—".
*/

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

const STATUS_FILTERS = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "despachado", label: "Despachado" },
  { value: "falla", label: "Falla" },
  { value: "cancelada", label: "Cancelada" },
];

// falla agrupa los dos motivos (stock y robot).
const matchesStatusFilter = (uiKey, filter) => {
  if (!filter) return true;
  if (filter === "falla") return uiKey === "falla_stock" || uiKey === "falla_robot";
  return uiKey === filter;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Ventana fija por sesión: evita recalcular en cada render.
const LAST_30_DAYS_SINCE = Date.now() - THIRTY_DAYS_MS;

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

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [userNames, setUserNames] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [detail, setDetail] = useState(null);
  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelSending, setCancelSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [orderList, productList] = await Promise.all([
        orderService.list(),
        productService.listAll({ isActive: true }).catch(() => []),
      ]);
      setOrders(
        [...orderList].sort(
          (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
        )
      );
      setProducts(productList);
      // El cruce de cliente es best-effort: requiere admin_system.
      userService
        .list({ size: 200 })
        .then(({ users }) => setUserNames(new Map(users.map((u) => [u.id, u.name]))))
        .catch(() => setUserNames(new Map()));
    } catch {
      setLoadError(
        "No se pudo cargar la gestión de ventas. Revisá la conexión con el backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    load();
  }, [load]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const decorated = useMemo(
    () =>
      orders.map((order) => {
        const ui = mapOrderStatus(order);
        const resolvedItems = order.items.map((item) => {
          const product = productById.get(item.productId);
          return {
            ...item,
            name: product?.name ?? "Producto dado de baja",
            imageUrl: product?.imageUrl ?? "",
          };
        });
        return {
          ...order,
          uiKey: ui.key,
          uiLabel: ui.label,
          uiVariant: ui.variant,
          client: userNames.get(order.requestedByUserId) ?? "—",
          items: resolvedItems,
          firstItem: resolvedItems[0] ?? null,
          extraItems: Math.max(0, resolvedItems.length - 1),
          totalQty: resolvedItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
        };
      }),
    [orders, productById, userNames]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated.filter((order) => {
      if (!matchesStatusFilter(order.uiKey, statusFilter)) return false;
      const day = isoDay(order.createdAt);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      if (!q) return true;
      return (
        (order.code || "").toLowerCase().includes(q) ||
        order.client.toLowerCase().includes(q) ||
        order.items.some(
          (i) =>
            (i.name || "").toLowerCase().includes(q) ||
            (i.sku || "").toLowerCase().includes(q)
        )
      );
    });
  }, [decorated, search, statusFilter, range]);

  const metrics = useMemo(() => {
    const last30 = decorated.filter(
      (o) => o.createdAt && new Date(o.createdAt).getTime() >= LAST_30_DAYS_SINCE
    );
    return {
      pending: decorated.filter((o) => o.uiKey === "pendiente").length,
      dispatched: last30.filter((o) => o.uiKey === "despachado").length,
      total: last30.length,
    };
  }, [decorated]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason("");
    setCancelError(null);
  };

  const closeCancel = () => {
    if (cancelSending) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError("Indicá el motivo de la cancelación.");
      return;
    }
    setCancelSending(true);
    setCancelError(null);
    try {
      await orderService.cancel(cancelTarget.id, cancelReason.trim());
      setCancelTarget(null);
      setDetail(null);
      setFeedback({ type: "ok", text: "Orden cancelada correctamente." });
      await load();
    } catch {
      setCancelError("No se pudo cancelar la orden. Intentá de nuevo.");
    } finally {
      setCancelSending(false);
    }
  };

  const detailItems = detail
    ? decorated.find((o) => o.id === detail.id)?.items ?? []
    : [];

  return (
    <div className="sales">
      <PageHeader
        title="Gestión de Ventas"
        subtitle="Visualizá y gestioná las órdenes de compra realizadas por tus clientes. Marcá como despachadas las órdenes para actualizar el stock de reserva."
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

      {/* ── Métricas ─────────────────────────────────────── */}
      <div className="sales__metrics">
        <div className="sales__metric sales__metric--pending">
          <span className="sales__metric-icon">
            <Icon name="cart" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Órdenes pendientes de despacho</span>
            <span className="sales__metric-value">{loading ? "…" : metrics.pending}</span>
          </span>
        </div>
        <div className="sales__metric sales__metric--dispatched">
          <span className="sales__metric-icon">
            <Icon name="box" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Órdenes despachadas</span>
            <span className="sales__metric-value">{loading ? "…" : metrics.dispatched}</span>
            <span className="sales__metric-sub">Últimos 30 días</span>
          </span>
        </div>
        <div className="sales__metric sales__metric--total">
          <span className="sales__metric-icon">
            <Icon name="calendar" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Total de órdenes</span>
            <span className="sales__metric-value">{loading ? "…" : metrics.total}</span>
            <span className="sales__metric-sub">Últimos 30 días</span>
          </span>
        </div>
      </div>

      {/* ── Tabla ────────────────────────────────────────── */}
      <Card padding="none" className="sales-panel">
        <header className="sales-panel__head">
          <h3 className="sales-panel__title">Órdenes de compra</h3>
        </header>

        <div className="sales-panel__toolbar">
          <Input
            placeholder="Buscar por número de orden, cliente o producto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            iconLeft={<Icon name="search" size={16} />}
          />
          <button
            type="button"
            className={`sales-panel__filters-btn ${
              filtersOpen ? "sales-panel__filters-btn--on" : ""
            }`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Icon name="filter" size={16} />
            Filtros
          </button>
        </div>

        {filtersOpen && (
          <div className="sales-panel__filters">
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STATUS_FILTERS}
            />
            <DateRangeFilter
              label="Fecha de compra"
              value={range}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
            />
          </div>
        )}

        {loading ? (
          <div className="sales-panel__loading">
            <Spinner size={28} label="Cargando órdenes…" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="No hay órdenes"
            description="No encontramos órdenes de compra con los filtros seleccionados."
          />
        ) : (
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Orden compra</th>
                  <th>Fecha compra</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Fecha despacho</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id}>
                    <td className="sales-table__order">{order.code}</td>
                    <td className="sales-table__date">{formatDate(order.createdAt)}</td>
                    <td>{order.client}</td>
                    <td>
                      {order.firstItem ? (
                        <div className="sales-table__product">
                          <span className="sales-table__thumb">
                            <Icon name="box" size={18} />
                            {order.firstItem.imageUrl && (
                              <img src={order.firstItem.imageUrl} alt="" loading="lazy" />
                            )}
                          </span>
                          <span className="sales-table__product-name" title={order.firstItem.name}>
                            {order.firstItem.name}
                            {order.extraItems > 0 && (
                              <span className="sales-table__product-more">
                                {" "}+{order.extraItems} más
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="sales-table__sku">{order.firstItem?.sku ?? "—"}</td>
                    <td className="sales-table__num">{order.totalQty} unidades</td>
                    <td>
                      <Badge variant={order.uiVariant} dot>
                        {order.uiLabel}
                      </Badge>
                    </td>
                    <td className="sales-table__date">{formatDate(order.completedAt)}</td>
                    <td>
                      {order.uiKey === "pendiente" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          iconLeft={<Icon name="truck" size={15} />}
                          onClick={() => setDispatchTarget(order)}
                        >
                          Marcar como despachado
                        </Button>
                      ) : (
                        <button
                          type="button"
                          className="sales-table__detail"
                          onClick={() => setDetail(order)}
                        >
                          Ver detalle
                          <span aria-hidden="true">&gt;</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <footer className="sales-panel__foot">
            <span className="sales-panel__showing">
              Mostrando {start + 1} a {Math.min(start + pageSize, filtered.length)} de{" "}
              {filtered.length} órdenes
            </span>
            <Pagination
              current={Math.min(page, totalPages)}
              total={totalPages}
              onChange={setPage}
            />
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS}
            />
          </footer>
        )}
      </Card>

      {/* ── Detalle ──────────────────────────────────────── */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Orden ${detail.code}` : ""}
        subtitle="Visualizá el recorrido de la orden y su detalle."
        size="md"
        footer={
          <div className="sales__modal-foot">
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Cerrar
            </Button>
            {detail &&
              (detail.uiKey === "pendiente" || detail.uiKey === "en_proceso") && (
                <Button
                  variant="danger-outline"
                  iconLeft={<Icon name="trash" size={15} />}
                  onClick={() => openCancel(detail)}
                >
                  Cancelar orden
                </Button>
              )}
          </div>
        }
      >
        {detail && (
          <>
            <dl className="sales__detail-grid">
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge variant={detail.uiVariant} dot>
                    {detail.uiLabel}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>Cliente</dt>
                <dd>{detail.client}</dd>
              </div>
              <div>
                <dt>Rover asignado</dt>
                <dd>{detail.assignedVehicleId ?? "—"}</dd>
              </div>
              <div>
                <dt>Área destino</dt>
                <dd>{detail.destinationArea || "—"}</dd>
              </div>
              <div>
                <dt>Creada</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt>Iniciada</dt>
                <dd>{formatDateTime(detail.startedAt)}</dd>
              </div>
              <div>
                <dt>Despachada / cerrada</dt>
                <dd>{formatDateTime(detail.completedAt)}</dd>
              </div>
              {detail.cancelReason && (
                <div>
                  <dt>Motivo</dt>
                  <dd>{detail.cancelReason}</dd>
                </div>
              )}
            </dl>

            <h4 className="sales__detail-title">Productos ({detail.totalQty})</h4>
            <ul className="sales__items">
              {detailItems.map((item, i) => (
                <li key={`${item.productId}-${i}`}>
                  <span className="sales-table__thumb">
                    <Icon name="box" size={18} />
                    {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
                  </span>
                  <span className="sales__item-text">
                    <span className="sales__item-name">{item.name}</span>
                    <span className="sales__item-sku">{item.sku}</span>
                  </span>
                  <span className="sales-table__num">{item.quantity} un.</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>

      {/* ── Despacho (sin endpoint: se informa) ──────────── */}
      <Modal
        open={dispatchTarget !== null}
        onClose={() => setDispatchTarget(null)}
        title={dispatchTarget ? `Despachar orden ${dispatchTarget.code}` : ""}
        subtitle="Confirmá el despacho de la mercadería al cliente."
        size="sm"
        footer={
          <div className="sales__modal-foot">
            <Button variant="secondary" onClick={() => setDispatchTarget(null)}>
              Volver
            </Button>
            <Button variant="primary" onClick={() => setDispatchTarget(null)}>
              Entendido
            </Button>
          </div>
        }
      >
        {dispatchTarget && (
          <p className="sales__dispatch-note">
            El despacho todavía no se puede marcar a mano: la orden la completa
            el rover asignado por Central. Cuando se complete, sale de
            pendientes y se descuenta la reserva.
          </p>
        )}
      </Modal>

      {/* ── Cancelar (endpoint real) ─────────────────────── */}
      <Modal
        open={cancelTarget !== null}
        onClose={closeCancel}
        title={cancelTarget ? `Cancelar orden ${cancelTarget.code}` : ""}
        subtitle="Esta acción no se puede deshacer."
        size="sm"
        footer={
          <div className="sales__modal-foot">
            <Button variant="secondary" onClick={closeCancel} disabled={cancelSending}>
              Volver
            </Button>
            <Button variant="danger" onClick={confirmCancel} disabled={cancelSending}>
              {cancelSending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </div>
        }
      >
        {cancelTarget && (
          <>
            <Input
              label="Motivo"
              placeholder="Ej. El cliente desistió de la compra"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelError(null);
              }}
              required
            />
            {cancelError && <p className="sales__cancel-error">{cancelError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
