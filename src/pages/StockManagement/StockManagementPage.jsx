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
import Icon from "../../components/ui/Icon/Icon";
import RestockOrderModal from "../../components/stock/RestockOrderModal/RestockOrderModal";
import RemitoModal from "../../components/stock/RemitoModal/RemitoModal";
import { restockService } from "../../services/restockService";
import { productService } from "../../services/productService";
import "./StockManagementPage.css";

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

// Estados derivados: el backend no tiene campo `status` en RestockOrder. El
// proxy es quantity_received_so_far contra lo solicitado (GET /restock/orders/:id).
const STATUS_META = {
  pendiente: { label: "Pendiente", plural: "Pendientes", variant: "warning" },
  recibido: { label: "Recibido", plural: "Recibidos", variant: "info" },
  completado: { label: "Completado", plural: "Completados", variant: "success" },
};

const STATUS_KEYS = Object.keys(STATUS_META);

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...STATUS_KEYS.map((key) => ({ value: key, label: STATUS_META[key].label })),
];

const PAGE_SIZE_OPTIONS = [
  { value: "5", label: "5 por página" },
  { value: "10", label: "10 por página" },
  { value: "20", label: "20 por página" },
];

const deriveStatus = (requested, received) => {
  if (received >= requested) return "completado";
  if (received > 0) return "recibido";
  return "pendiente";
};

const formatDate = (iso) => {
  const day = String(iso ?? "").slice(0, 10);
  return day ? day.split("-").reverse().join("/") : "—";
};

const formatDateTime = (iso) => {
  const [date, time] = String(iso ?? "").split("T");
  if (!date) return "—";
  return `${formatDate(date)} ${(time || "").slice(0, 8)}`;
};

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

export default function StockManagementPage() {
  const [restockOpen, setRestockOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pendiente");
  const [product, setProduct] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Trae el listado real de órdenes, lo enriquece con el detalle (recibido
  // hasta ahora) y el join a producto (nombre/SKU). El backend no envía esos
  // campos en el listado, así que se resuelven acá.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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

      setOrders(
        all.map((order) => {
          const received =
            detailById.get(order.id)?.quantityReceivedSoFar ?? 0;
          const product = productById.get(order.productId);
          return {
            ...order,
            product: product?.name ?? "Producto",
            sku: product?.sku ?? "—",
            received,
            status: deriveStatus(order.quantityRequested, received),
          };
        })
      );
    } catch (err) {
      setOrders([]);
      setLoadError(
        err?.response?.data?.error?.message ||
          "No pudimos cargar las órdenes de restock."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load setea loading/error de forma síncrona para manejar la UI de carga;
    // es intencional, no el cascade derivado de render que esta regla previene.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleOpen = (key) => {
    if (key === "restock") setRestockOpen(true);
    if (key === "receiving") setReceivingOpen(true);
  };

  const productOptions = useMemo(
    () => [
      { value: "", label: "Todos los productos" },
      ...[...new Map(orders.map((o) => [o.productId, o.product])).entries()]
        .filter(([, name]) => name)
        .sort((a, b) => a[1].localeCompare(b[1], "es"))
        .map(([id, name]) => ({ value: id, label: name })),
    ],
    [orders]
  );

  // Filtros que NO son el estado: sobre este subconjunto se cuentan las
  // pestañas, para que los números acompañen a la búsqueda.
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (
        q &&
        !order.product.toLowerCase().includes(q) &&
        !order.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (product && order.productId !== product) return false;
      const day = String(order.createdAt ?? "").slice(0, 10);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      return true;
    });
  }, [orders, search, product, range]);

  const counts = useMemo(() => {
    const acc = {};
    for (const order of matching) {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
    }
    return acc;
  }, [matching]);

  const filtered = useMemo(
    () => (status ? matching.filter((order) => order.status === status) : matching),
    [matching, status]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  // El Select de estado y las pestañas son dos vistas del mismo filtro.
  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="stock-management">
      <PageHeader
        title="Gestión de stock"
        subtitle="Gestioná tus órdenes de restock y registrá las recepciones de mercadería para mantener tu stock actualizado."
      />

      <div className="stock-management__actions">
        {ACTION_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`stock-management__card stock-management__card--${card.variant}`}
            onClick={() => handleOpen(card.key)}
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

      <Card padding="md" className="stock-management__filters">
        <div className="stock-management__filter">
          <Input
            placeholder="Buscar por producto o SKU"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            iconLeft={<Icon name="search" size={16} />}
          />
        </div>
        <div className="stock-management__filter">
          <Select
            label="Estado"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="stock-management__filter">
          <Select
            label="Producto"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setPage(1);
            }}
            options={productOptions}
          />
        </div>
        <div className="stock-management__filter">
          <DateRangeFilter
            label="Fecha de creación"
            value={range}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Card padding="none" className="stock-management__table-card">
        <div className="stock-management__tabs" role="tablist">
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={status === key}
              className={`stock-management__tab ${
                status === key ? "stock-management__tab--active" : ""
              }`}
              onClick={() => changeStatus(key)}
            >
              {STATUS_META[key].plural}
              <span className="stock-management__tab-count">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {loadError ? (
          <div className="stock-management__status">
            <p className="stock-management__status-msg stock-management__status-msg--error">
              {loadError}
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              Reintentar
            </Button>
          </div>
        ) : loading && pageItems.length === 0 ? (
          <div className="stock-management__status">
            <p className="stock-management__status-msg">Cargando órdenes…</p>
          </div>
        ) : pageItems.length === 0 ? (
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
                  <th>Orden</th>
                  <th>Fecha de creación</th>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Cantidad solicitada</th>
                  <th>Recibido</th>
                  <th>Estado</th>
                  <th>Proveedor</th>
                  <th className="stock-table__actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((order) => (
                  <tr key={order.id}>
                    <td className="stock-table__order">{order.id}</td>
                    <td className="stock-table__date">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <div className="stock-table__product">
                        <span className="stock-table__thumb" aria-hidden="true">
                          <Icon name="box" size={18} />
                        </span>
                        {order.product}
                      </div>
                    </td>
                    <td className="stock-table__sku">{order.sku}</td>
                    <td>{units(order.quantityRequested)}</td>
                    <td>{units(order.received)}</td>
                    <td>
                      <Badge variant={STATUS_META[order.status].variant} dot>
                        {STATUS_META[order.status].label}
                      </Badge>
                    </td>
                    <td>{order.supplier}</td>
                    <td>
                      <button
                        type="button"
                        className="stock-table__detail"
                        onClick={() => setDetail(order)}
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
      </Card>

      {filtered.length > 0 && (
        <footer className="stock-management__footer">
          <span className="stock-management__count">
            Mostrando {pageStart + 1} a{" "}
            {Math.min(pageStart + pageSize, filtered.length)} de {filtered.length}{" "}
            órdenes
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
        </footer>
      )}

      <RestockOrderModal
        open={restockOpen}
        onClose={() => setRestockOpen(false)}
        onCreated={load}
      />
      <RemitoModal open={receivingOpen} onClose={() => setReceivingOpen(false)} />

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Orden ${detail.id}` : ""}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        }
      >
        {detail && (
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
              <dd>{detail.product}</dd>
            </div>
            <div>
              <dt>SKU</dt>
              <dd>{detail.sku}</dd>
            </div>
            <div>
              <dt>Proveedor</dt>
              <dd>{detail.supplier}</dd>
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
              <dd>{units(detail.received)}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}