import { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card from "../../components/ui/Card/Card";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import Pagination from "../../components/ui/Pagination/Pagination";
import Icon from "../../components/ui/Icon/Icon";
import RestockPendingCard from "../../components/stock/RestockPendingCard/RestockPendingCard";
import LocationAssignmentModal from "../../components/stock/LocationAssignmentModal/LocationAssignmentModal";
import "./StockAssignmentPage.css";

const PENDING_RESTOCK = [
  { id: 1, name: "Mouse inalámbrico Logitech M185", sku: "MOU-001", orderId: "RST-00018", received: 20, receivedAt: "22/05/2024" },
  { id: 2, name: "Teclado mecánico RGB", sku: "TEC-014", orderId: "RST-00017", received: 30, receivedAt: "21/05/2024" },
  { id: 3, name: "Auriculares con micrófono", sku: "AUR-022", orderId: "RST-00016", received: 15, receivedAt: "20/05/2024" },
  { id: 4, name: "Monitor 24 pulgadas", sku: "MON-032", orderId: "RST-00015", received: 8, receivedAt: "19/05/2024" },
  { id: 5, name: "Webcam HD 1080p", sku: "WEB-008", orderId: "RST-00014", received: 25, receivedAt: "18/05/2024" },
  { id: 6, name: "Cámara IP seguridad", sku: "CAM-021", orderId: "RST-00013", received: 12, receivedAt: "17/05/2024" },
  { id: 7, name: "Disco SSD 1TB", sku: "SSD-064", orderId: "RST-00012", received: 40, receivedAt: "16/05/2024" },
  { id: 8, name: "Router WiFi 6", sku: "ROU-009", orderId: "RST-00011", received: 18, receivedAt: "15/05/2024" },
  { id: 9, name: "Lector de código barras", sku: "LEC-017", orderId: "RST-00010", received: 22, receivedAt: "14/05/2024" },
  { id: 10, name: "Impresora térmica", sku: "IMP-011", orderId: "RST-00009", received: 10, receivedAt: "13/05/2024" },
  { id: 11, name: "Notebook 14 pulgadas", sku: "NOT-045", orderId: "RST-00008", received: 5, receivedAt: "12/05/2024" },
  { id: 12, name: "Tablet 10 pulgadas", sku: "TAB-030", orderId: "RST-00007", received: 14, receivedAt: "11/05/2024" },
  { id: 13, name: "Parlante bluetooth", sku: "PAR-005", orderId: "RST-00006", received: 30, receivedAt: "10/05/2024" },
  { id: 14, name: "Cable HDMI 2m", sku: "CAB-003", orderId: "RST-00005", received: 100, receivedAt: "09/05/2024" },
  { id: 15, name: "Adaptador USB-C", sku: "ADA-007", orderId: "RST-00004", received: 50, receivedAt: "08/05/2024" },
  { id: 16, name: "Hub USB 4 puertos", sku: "HUB-002", orderId: "RST-00003", received: 35, receivedAt: "07/05/2024" },
  { id: 17, name: "Mousepad XL", sku: "MPA-011", orderId: "RST-00002", received: 45, receivedAt: "06/05/2024" },
  { id: 18, name: "Soporte monitor VESA", sku: "SOP-009", orderId: "RST-00001", received: 20, receivedAt: "05/05/2024" },
  { id: 19, name: "Foco smart LED", sku: "FOC-004", orderId: "RST-00019", received: 60, receivedAt: "23/05/2024" },
  { id: 20, name: "Sensor de temperatura", sku: "SEN-006", orderId: "RST-00020", received: 25, receivedAt: "24/05/2024" },
  { id: 21, name: "Cargador inalámbrico", sku: "CAR-008", orderId: "RST-00021", received: 40, receivedAt: "25/05/2024" },
  { id: 22, name: "Webcam 4K", sku: "WEB-012", orderId: "RST-00022", received: 10, receivedAt: "26/05/2024" },
  { id: 23, name: "Teclado inalámbrico", sku: "TEC-015", orderId: "RST-00023", received: 28, receivedAt: "27/05/2024" },
  { id: 24, name: "Mouse gaming", sku: "MOU-002", orderId: "RST-00024", received: 16, receivedAt: "28/05/2024" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Todas las categorías" },
  { value: "perifericos", label: "Periféricos" },
  { value: "redes", label: "Redes" },
  { value: "monitores", label: "Monitores" },
  { value: "almacenamiento", label: "Almacenamiento" },
  { value: "impresion", label: "Impresión" },
];

const LOCATION_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Sin ubicación asignada" },
  { value: "assigned", label: "Con ubicación" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "6", label: "6 por página" },
  { value: "12", label: "12 por página" },
  { value: "24", label: "24 por página" },
];

export default function StockAssignmentPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filtered = useMemo(() => {
    return PENDING_RESTOCK.filter((item) => {
      const q = search.trim().toLowerCase();
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) {
        return false;
      }
      if (locationStatus === "assigned") return false;
      return true;
    });
  }, [search, locationStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const handleOpenAssign = (product) => {
    setSelectedProduct(product);
    setAssignOpen(true);
  };

  const handleCloseAssign = () => {
    setAssignOpen(false);
    setSelectedProduct(null);
  };

  return (
    <div className="stock-assignment">
      <PageHeader
        title="Asignación de ubicación"
        subtitle="Productos de restock pendientes de ubicación. Asigná una ubicación disponible para cada producto recibido."
      />

      <div className="stock-assignment__search">
        <Input
          placeholder="Buscar por nombre o SKU"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          iconLeft={<Icon name="search" size={16} />}
        />
      </div>

      <Card padding="md" className="stock-assignment__filters">
        <div className="stock-assignment__filter">
          <Select
            label="Categoría"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div className="stock-assignment__filter">
          <Select
            label="Estado de ubicación"
            value={locationStatus}
            onChange={(e) => { setLocationStatus(e.target.value); setPage(1); }}
            options={LOCATION_STATUS_OPTIONS}
          />
        </div>
        <button className="stock-assignment__more-filters" type="button">
          <Icon name="list" size={16} />
          Filtros
        </button>
      </Card>

      <div className="stock-assignment__grid">
        {pageItems.map((product) => (
          <RestockPendingCard
            key={product.id}
            product={product}
            onAssign={handleOpenAssign}
          />
        ))}
      </div>

      {filtered.length > 0 && (
        <footer className="stock-assignment__footer">
          <span className="stock-assignment__count">
            Mostrando {pageStart + 1} a{" "}
            {Math.min(pageStart + pageSize, filtered.length)} de{" "}
            {filtered.length} productos
          </span>
          <Pagination current={page} total={totalPages} onChange={setPage} />
          <Select
            value={String(pageSize)}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            options={PAGE_SIZE_OPTIONS}
          />
        </footer>
      )}

      <LocationAssignmentModal
        open={assignOpen}
        onClose={handleCloseAssign}
        product={selectedProduct}
      />
    </div>
  );
}
