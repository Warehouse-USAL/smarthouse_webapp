import { useMemo, useState } from "react";
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

// Estados de una orden de restock. `variant` es la variante del Badge.
const STATUS_META = {
  pendiente: { label: "Pendiente", plural: "Pendientes", variant: "warning" },
  recibido: { label: "Recibido", plural: "Recibidos", variant: "info" },
  completado: { label: "Completado", plural: "Completados", variant: "success" },
  cancelado: { label: "Cancelado", plural: "Cancelados", variant: "neutral" },
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

// Datos de ejemplo para maquetar la pantalla. En el próximo sprint se
// reemplazan por el listado real (GET /orders), ordenado por fecha desc.
const ORDERS = [
  { id: "RST-00023", createdAt: "2024-05-22T09:40", product: "Notebook 14 pulgadas", sku: "NOT-045", requested: 10, received: 0, status: "pendiente", estimatedAt: "2024-05-27" },
  { id: "RST-00022", createdAt: "2024-05-21T15:05", product: "Router WiFi 6", sku: "ROU-009", requested: 40, received: 0, status: "pendiente", estimatedAt: "2024-05-26" },
  { id: "RST-00021", createdAt: "2024-05-21T11:30", product: "Auriculares con micrófono", sku: "AUR-022", requested: 60, received: 0, status: "pendiente", estimatedAt: "2024-05-25" },
  { id: "RST-00020", createdAt: "2024-05-20T17:20", product: "Disco SSD 1TB", sku: "SSD-064", requested: 35, received: 0, status: "pendiente", estimatedAt: "2024-05-24" },
  { id: "RST-00019", createdAt: "2024-05-20T08:55", product: "Webcam HD", sku: "WEB-008", requested: 25, received: 0, status: "pendiente", estimatedAt: "2024-05-23" },
  { id: "RST-00018", createdAt: "2024-05-19T10:30", product: "Mouse inalámbrico", sku: "MOU-001", requested: 50, received: 0, status: "pendiente", estimatedAt: "2024-05-22" },
  { id: "RST-00017", createdAt: "2024-05-19T09:15", product: "Teclado mecánico", sku: "TEC-014", requested: 30, received: 0, status: "pendiente", estimatedAt: "2024-05-21" },
  { id: "RST-00016", createdAt: "2024-05-18T16:45", product: "Cámara IP", sku: "CAM-021", requested: 20, received: 10, status: "recibido", estimatedAt: "2024-05-20" },
  { id: "RST-00015", createdAt: "2024-05-18T11:20", product: "Lector de código", sku: "LEC-017", requested: 25, received: 25, status: "completado", estimatedAt: "2024-05-18" },
  { id: "RST-00014", createdAt: "2024-05-17T14:10", product: "Monitor 24 pulgadas", sku: "MON-032", requested: 15, received: 0, status: "cancelado", estimatedAt: "2024-05-19" },
  { id: "RST-00013", createdAt: "2024-05-17T10:05", product: "Impresora térmica", sku: "IMP-011", requested: 12, received: 0, status: "pendiente", estimatedAt: "2024-05-21" },
  { id: "RST-00012", createdAt: "2024-05-16T16:40", product: "Tablet 10 pulgadas", sku: "TAB-030", requested: 18, received: 0, status: "pendiente", estimatedAt: "2024-05-20" },
  { id: "RST-00011", createdAt: "2024-05-16T12:15", product: "Mouse inalámbrico", sku: "MOU-001", requested: 45, received: 0, status: "pendiente", estimatedAt: "2024-05-20" },
  { id: "RST-00010", createdAt: "2024-05-16T09:30", product: "Cámara IP", sku: "CAM-021", requested: 22, received: 22, status: "completado", estimatedAt: "2024-05-19" },
  { id: "RST-00009", createdAt: "2024-05-15T18:00", product: "Teclado mecánico", sku: "TEC-014", requested: 28, received: 14, status: "recibido", estimatedAt: "2024-05-19" },
  { id: "RST-00008", createdAt: "2024-05-15T14:25", product: "Monitor 24 pulgadas", sku: "MON-032", requested: 16, received: 16, status: "completado", estimatedAt: "2024-05-18" },
  { id: "RST-00007", createdAt: "2024-05-15T10:10", product: "Lector de código", sku: "LEC-017", requested: 30, received: 0, status: "pendiente", estimatedAt: "2024-05-18" },
  { id: "RST-00006", createdAt: "2024-05-14T16:50", product: "Router WiFi 6", sku: "ROU-009", requested: 24, received: 12, status: "recibido", estimatedAt: "2024-05-17" },
  { id: "RST-00005", createdAt: "2024-05-14T11:05", product: "Notebook 14 pulgadas", sku: "NOT-045", requested: 8, received: 8, status: "completado", estimatedAt: "2024-05-17" },
  { id: "RST-00004", createdAt: "2024-05-13T15:35", product: "Webcam HD", sku: "WEB-008", requested: 20, received: 0, status: "pendiente", estimatedAt: "2024-05-16" },
  { id: "RST-00003", createdAt: "2024-05-13T09:50", product: "Auriculares con micrófono", sku: "AUR-022", requested: 50, received: 30, status: "recibido", estimatedAt: "2024-05-16" },
  { id: "RST-00002", createdAt: "2024-05-12T14:20", product: "Disco SSD 1TB", sku: "SSD-064", requested: 15, received: 15, status: "completado", estimatedAt: "2024-05-15" },
  { id: "RST-00001", createdAt: "2024-05-12T10:00", product: "Impresora térmica", sku: "IMP-011", requested: 10, received: 0, status: "cancelado", estimatedAt: "2024-05-15" },
];

const PRODUCT_OPTIONS = [
  { value: "", label: "Todos los productos" },
  ...[...new Set(ORDERS.map((o) => o.product))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => ({ value: name, label: name })),
];

const formatDate = (iso) => iso.split("-").reverse().join("/");

const formatDateTime = (iso) => {
  const [date, time] = iso.split("T");
  return `${formatDate(date)} ${time}`;
};

const units = (n) => `${n} unidad${n === 1 ? "" : "es"}`;

export default function StockManagementPage() {
  const [restockOpen, setRestockOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pendiente");
  const [product, setProduct] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const handleOpen = (key) => {
    if (key === "restock") setRestockOpen(true);
    if (key === "receiving") setReceivingOpen(true);
  };

  // Filtros que NO son el estado: sobre este subconjunto se cuentan las
  // pestañas, para que los números acompañen a la búsqueda.
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ORDERS.filter((order) => {
      if (
        q &&
        !order.product.toLowerCase().includes(q) &&
        !order.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (product && order.product !== product) return false;
      const day = order.createdAt.slice(0, 10);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      return true;
    });
  }, [search, product, range]);

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
            options={PRODUCT_OPTIONS}
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

        {pageItems.length === 0 ? (
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
                  <th>Fecha estimada</th>
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
                    <td>{units(order.requested)}</td>
                    <td>{units(order.received)}</td>
                    <td>
                      <Badge variant={STATUS_META[order.status].variant} dot>
                        {STATUS_META[order.status].label}
                      </Badge>
                    </td>
                    <td className="stock-table__date">{formatDate(order.estimatedAt)}</td>
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

      <RestockOrderModal open={restockOpen} onClose={() => setRestockOpen(false)} />
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
              <dt>Fecha de creación</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>
            </div>
            <div>
              <dt>Fecha estimada</dt>
              <dd>{formatDate(detail.estimatedAt)}</dd>
            </div>
            <div>
              <dt>Cantidad solicitada</dt>
              <dd>{units(detail.requested)}</dd>
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
