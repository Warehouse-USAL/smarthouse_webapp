import { Fragment, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import TablePanel, { TablePanelTable } from "../../components/ui/TablePanel/TablePanel";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import DateRangeFilter from "../../components/ui/DateRangeFilter/DateRangeFilter";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import LoadError from "../../components/ui/LoadError/LoadError";
import Pagination from "../../components/ui/Pagination/Pagination";
import Spinner from "../../components/ui/Spinner/Spinner";
import StatusBanner from "../../components/ui/StatusBanner/StatusBanner";
import Icon from "../../components/ui/Icon/Icon";
import SortableHeader from "../../components/ui/SortableHeader/SortableHeader";
import { orderService, mapOrderStatus } from "../../services/orderService";
import { productService } from "../../services/productService";
import { userService } from "../../services/userService";
import { daysAgo } from "../../lib/pagination";
import "./SalesPage.css";

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

/*
| Gestión de Ventas (Order = despacho al cliente, NO confundir con restock).
|
| El estado de la orden no se maneja acá: lo van cambiando los otros equipos
| (los rovers la completan vía Central, in_progress → completed) y esta
| pantalla solo lo muestra. Cancelar sí existe (POST /orders/:id/cancel).
|
| Cliente: Order solo trae requested_by_user_id. Se cruza con userService
| cuando el rol lo permite (requiere admin_system); si no, "—".
|
| Con dos años de historial la tabla pagina y ordena en el backend
| (POST /query/orders): estado y fechas viajan como filtros. Esa consulta no
| trae los productos de cada orden, así que se piden con GET /orders/:id recién
| al expandir la fila o abrir "Ver detalle", y se guardan para no repetirlos.
| El buscador no tiene endpoint y filtra solo la página visible.
*/

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

// Valores del backend. "Falla" no es un estado propio (es cancelled + motivo),
// así que no se puede pedir por separado.
const STATUS_FILTERS = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "completed", label: "Despachado" },
  { value: "cancelled", label: "Cancelada / falla" },
];

// Arranca acotado: sin rango, la primera carga recorre dos años de órdenes.
const DEFAULT_RANGE_DAYS = 90;

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

export default function SalesPage() {
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [userNames, setUserNames] = useState(new Map());
  const [feedback, setFeedback] = useState(null);
  // Se incrementa para volver a pedir la página y las métricas (p. ej. tras cancelar).
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [range, setRange] = useState(() => ({ from: daysAgo(DEFAULT_RANGE_DAYS), to: "" }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Órdenes desplegadas: un renglón por producto debajo.
  const [expanded, setExpanded] = useState(() => new Set());
  // Detalle de cada orden ya pedida: id → { loading } | { order } | { error }.
  const [details, setDetails] = useState(() => new Map());
  // Orden de la tabla: { field, dir } o null (más nuevas primero).
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [detail, setDetail] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelSending, setCancelSending] = useState(false);

  useEffect(() => {
    productService
      .listAll({ isActive: true })
      .then(setProducts)
      .catch(() => setProducts([]));
    // El cruce de cliente es best-effort: requiere admin_system.
    userService
      .listAll()
      .then((users) => setUserNames(new Map(users.map((u) => [u.id, u.name]))))
      .catch(() => setUserNames(new Map()));
  }, []);

  // reloadKey no viaja al backend: solo hace que la query sea otra.
  const query = useMemo(
    () => ({
      params: {
        page,
        size: pageSize,
        status: statusFilter || undefined,
        from: range.from,
        to: range.to,
        sort: sort ?? undefined,
      },
      reloadKey,
    }),
    [page, pageSize, statusFilter, range, sort, reloadKey]
  );

  // { query, items, totalElements, totalPages, error } de la última respuesta.
  // Mientras no corresponda a la query actual, la página está cargando.
  const [pageResult, setPageResult] = useState(null);

  useEffect(() => {
    let stale = false;
    orderService
      .listPage(query.params)
      .then((result) => ({ ...result, error: null }))
      .catch(() => ({
        items: [],
        totalElements: 0,
        totalPages: 1,
        error: "No se pudo cargar la gestión de ventas. Revisá la conexión con el backend.",
      }))
      .then((result) => {
        if (stale) return;
        // Tras cancelar puede quedar una página menos: se vuelve a la última.
        if (result.totalPages > 0 && query.params.page > result.totalPages) {
          setPage(result.totalPages);
          return;
        }
        setPageResult({ ...result, query });
      });
    return () => {
      stale = true;
    };
  }, [query]);

  // Mientras carga se conserva la respuesta anterior: el paginador no parpadea.
  const loading = pageResult?.query !== query;
  const orders = useMemo(() => pageResult?.items ?? [], [pageResult]);
  const totalElements = pageResult?.totalElements ?? 0;
  const totalPages = Math.max(1, pageResult?.totalPages ?? 1);
  const loadError = pageResult?.error ?? null;

  useEffect(() => {
    const last30 = { from: daysAgo(30) };
    Promise.all([
      orderService.count({ status: "pending" }),
      orderService.count({ ...last30, status: "completed" }),
      orderService.count(last30),
    ])
      .then(([pending, dispatched, total]) => setMetrics({ pending, dispatched, total }))
      .catch(() => setMetrics({ pending: "—", dispatched: "—", total: "—" }));
  }, [reloadKey]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const decorated = useMemo(
    () =>
      orders.map((order) => {
        const ui = mapOrderStatus(order);
        return {
          ...order,
          uiKey: ui.key,
          uiLabel: ui.label,
          uiVariant: ui.variant,
          client: userNames.get(order.requestedByUserId) ?? "—",
        };
      }),
    [orders, userNames]
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decorated;
    return decorated.filter(
      (order) =>
        (order.code || "").toLowerCase().includes(q) ||
        order.client.toLowerCase().includes(q)
    );
  }, [decorated, search]);

  const start = (page - 1) * pageSize;

  // Productos de una orden con nombre e imagen del catálogo.
  const resolveItems = (order) =>
    (order?.items ?? []).map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        name: product?.name ?? "Producto dado de baja",
        imageUrl: product?.imageUrl ?? "",
      };
    });

  // Pide el detalle (con productos) una sola vez por orden.
  const loadDetail = (id) => {
    if (details.has(id) && !details.get(id).error) return;
    setDetails((prev) => new Map(prev).set(id, { loading: true }));
    orderService
      .get(id)
      .then((order) => setDetails((prev) => new Map(prev).set(id, { order })))
      .catch(() => setDetails((prev) => new Map(prev).set(id, { error: true })));
  };

  const toggleExpanded = (id) => {
    if (!expanded.has(id)) loadDetail(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (order) => {
    setDetail(order);
    loadDetail(order.id);
  };

  // Cada clic en un encabezado: ascendente, descendente y vuelta al defecto.
  const toggleSort = (field) => {
    setSort((prev) =>
      prev?.field !== field
        ? { field, dir: "asc" }
        : prev.dir === "asc"
          ? { field, dir: "desc" }
          : null
    );
    setPage(1);
  };

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
      setReloadKey((key) => key + 1);
    } catch {
      setCancelError("No se pudo cancelar la orden. Intentá de nuevo.");
    } finally {
      setCancelSending(false);
    }
  };

  // El detalle combina la orden completa (rover, área, productos) con la fila,
  // que tiene el estado más reciente.
  const detailState = detail ? details.get(detail.id) : null;
  const detailFull = detailState?.order ? { ...detailState.order, ...detail } : detail;
  const detailItems = resolveItems(detailState?.order);
  const detailQty = detailItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div className="sales">
      <PageHeader
        title="Gestión de Ventas"
        subtitle="Visualizá y gestioná las órdenes de compra realizadas por tus clientes."
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

      {/* ── Métricas ─────────────────────────────────────── */}
      <div className="sales__metrics">
        <div className="sales__metric sales__metric--pending">
          <span className="sales__metric-icon">
            <Icon name="cart" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Órdenes pendientes de despacho</span>
            <span className="sales__metric-value">{metrics ? metrics.pending : "…"}</span>
          </span>
        </div>
        <div className="sales__metric sales__metric--dispatched">
          <span className="sales__metric-icon">
            <Icon name="box" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Órdenes despachadas</span>
            <span className="sales__metric-value">{metrics ? metrics.dispatched : "…"}</span>
            <span className="sales__metric-sub">Últimos 30 días</span>
          </span>
        </div>
        <div className="sales__metric sales__metric--total">
          <span className="sales__metric-icon">
            <Icon name="calendar" size={22} />
          </span>
          <span className="sales__metric-text">
            <span className="sales__metric-label">Total de órdenes</span>
            <span className="sales__metric-value">{metrics ? metrics.total : "…"}</span>
            <span className="sales__metric-sub">Últimos 30 días</span>
          </span>
        </div>
      </div>

      {/* ── Tabla ────────────────────────────────────────── */}
      <TablePanel
        title="Órdenes de compra"
        search={{
          placeholder: "Buscar en esta página por orden o cliente...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
        }}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        filtersClassName="table-panel__filters--two"
        filters={
          filtersOpen && (
            <>
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
            </>
          )
        }
        footer={
          totalElements > 0 && (
            <>
              <span className="table-panel__showing">
                Mostrando {start + 1} a {start + orders.length} de{" "}
                {totalElements.toLocaleString("es-AR")} órdenes
              </span>
              <Pagination current={page} total={totalPages} onChange={setPage} />
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }
      >
        {loading ? (
          <div className="table-panel__loading">
            <Spinner size={28} label="Cargando órdenes…" />
          </div>
        ) : loadError ? (
          <LoadError onRetry={() => setReloadKey((key) => key + 1)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="No hay órdenes"
            description="No encontramos órdenes de compra con los filtros seleccionados."
          />
        ) : (
          <TablePanelTable className="sales-table">
            <thead>
              <tr>
                <th>Orden compra</th>
                <SortableHeader
                  label="Fecha compra"
                  field="created_at"
                  sort={sort}
                  onSort={toggleSort}
                />
                <th>Cliente</th>
                <SortableHeader label="Estado" field="status" sort={sort} onSort={toggleSort} />
                <SortableHeader
                  label="Fecha despacho"
                  field="completed_at"
                  sort={sort}
                  onSort={toggleSort}
                />
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => {
                const open = expanded.has(order.id);
                const state = details.get(order.id);
                return (
                  <Fragment key={order.id}>
                    <tr>
                      <td className="sales-table__order">
                        <span className="sales-table__order-cell">
                          <button
                            type="button"
                            className="sales-table__toggle"
                            onClick={() => toggleExpanded(order.id)}
                            aria-expanded={open}
                            aria-label={open ? "Ocultar productos" : "Ver productos"}
                          >
                            <Icon name={open ? "chevronDown" : "chevronRight"} size={16} />
                          </button>
                          {order.code}
                        </span>
                      </td>
                      <td className="sales-table__date">{formatDate(order.createdAt)}</td>
                      <td>{order.client}</td>
                      <td>
                        <Badge variant={order.uiVariant} dot>
                          {order.uiLabel}
                        </Badge>
                      </td>
                      <td className="sales-table__date">{formatDate(order.completedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="sales-table__detail"
                          onClick={() => openDetail(order)}
                        >
                          Ver detalle
                          <span aria-hidden="true">&gt;</span>
                        </button>
                      </td>
                    </tr>
                    {open &&
                      (!state || state.loading ? (
                        <tr className="sales-table__subrow">
                          <td colSpan={6}>
                            <Spinner size={18} label="Cargando productos…" />
                          </td>
                        </tr>
                      ) : state.error ? (
                        <tr className="sales-table__subrow">
                          <td colSpan={6}>No se pudieron cargar los productos de la orden.</td>
                        </tr>
                      ) : (
                        resolveItems(state.order).map((item, i) => (
                          <tr key={`${item.productId}-${i}`} className="sales-table__subrow">
                            <td />
                            <td colSpan={2}>
                              <div className="sales-table__product">
                                <span className="sales-table__thumb">
                                  <Icon name="box" size={18} />
                                  {item.imageUrl && (
                                    <img src={item.imageUrl} alt="" loading="lazy" />
                                  )}
                                </span>
                                <span className="sales-table__product-name" title={item.name}>
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="sales-table__sku">{item.sku || "—"}</td>
                            <td className="sales-table__num">{units(item.quantity)}</td>
                            <td />
                          </tr>
                        ))
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </TablePanelTable>
        )}
      </TablePanel>

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
                <dd>{detailFull.assignedVehicleId ?? "—"}</dd>
              </div>
              <div>
                <dt>Área destino</dt>
                <dd>{detailFull.destinationArea || "—"}</dd>
              </div>
              <div>
                <dt>Creada</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt>Iniciada</dt>
                <dd>{formatDateTime(detailFull.startedAt)}</dd>
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

            <h4 className="sales__detail-title">
              Productos{detailState?.order ? ` (${detailQty})` : ""}
            </h4>
            {!detailState || detailState.loading ? (
              <Spinner size={18} label="Cargando productos…" />
            ) : detailState.error ? (
              <p className="sales__cancel-error">
                No se pudieron cargar los productos de la orden.
              </p>
            ) : (
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
            )}
          </>
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
