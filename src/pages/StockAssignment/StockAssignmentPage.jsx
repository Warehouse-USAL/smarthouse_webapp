import { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Input from "../../components/ui/Input/Input";
import Icon from "../../components/ui/Icon/Icon";
import PendingLocationCard from "../../components/stock/PendingLocationCard/PendingLocationCard";
import ProductLocationModal from "../../components/stock/ProductLocationModal/ProductLocationModal";
import LocationAssignmentModal from "../../components/stock/LocationAssignmentModal/LocationAssignmentModal";
import "./StockAssignmentPage.css";

const PRODUCTS_WITHOUT_LOCATION = [
  { id: 1, name: "Micrófono condensador", sku: "MIC-003", category: "Periféricos", stockAvailable: 120 },
  { id: 2, name: "Smart TV 43 pulgadas", sku: "TV-010", category: "Monitores", stockAvailable: 15 },
  { id: 3, name: "Switch 24 puertos", sku: "SWI-006", category: "Redes", stockAvailable: 40 },
  { id: 4, name: "Pendrive 64GB", sku: "PEN-014", category: "Almacenamiento", stockAvailable: 200 },
  { id: 5, name: "Escáner A4", sku: "ESC-002", category: "Impresión", stockAvailable: 25 },
];

const PENDING_RESTOCK = [
  { id: 1, name: "Mouse inalámbrico Logitech M185", sku: "MOU-001", orderId: "RST-00018", received: 20, receivedAt: "22/05/2024" },
  { id: 2, name: "Teclado mecánico RGB", sku: "TEC-014", orderId: "RST-00017", received: 30, receivedAt: "21/05/2024" },
  { id: 3, name: "Auriculares con micrófono", sku: "AUR-022", orderId: "RST-00016", received: 15, receivedAt: "20/05/2024" },
  { id: 4, name: "Monitor 24 pulgadas", sku: "MON-032", orderId: "RST-00015", received: 8, receivedAt: "19/05/2024" },
  { id: 5, name: "Webcam HD 1080p", sku: "WEB-008", orderId: "RST-00014", received: 25, receivedAt: "18/05/2024" },
];

const matchesSearch = (item, q) =>
  !q ||
  item.name.toLowerCase().includes(q) ||
  item.sku.toLowerCase().includes(q);

export default function StockAssignmentPage() {
  const [search, setSearch] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedRestock, setSelectedRestock] = useState(null);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PRODUCTS_WITHOUT_LOCATION.filter((item) => matchesSearch(item, q));
  }, [search]);

  const filteredRestock = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PENDING_RESTOCK.filter((item) => matchesSearch(item, q));
  }, [search]);

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductModalOpen(false);
  };

  const openRestockModal = (product) => {
    setSelectedRestock(product);
    setRestockModalOpen(true);
  };

  const closeRestockModal = () => {
    setSelectedRestock(null);
    setRestockModalOpen(false);
  };

  return (
    <div className="stock-assignment">
      <PageHeader
        title="Asignación de ubicación"
        subtitle="Productos nuevos y de restock pendientes de ubicación. Asigná una ubicación disponible para cada uno."
      />

      <div className="stock-assignment__search">
        <Input
          placeholder="Buscar por nombre o SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={<Icon name="search" size={16} />}
        />
      </div>

      <section className="stock-assignment__section">
        <h2 className="stock-assignment__section-title">
          Productos sin ubicación asignada{" "}
          <span className="stock-assignment__section-count">
            ({filteredProducts.length})
          </span>
        </h2>
        <div className="stock-assignment__grid">
          {filteredProducts.map((product) => (
            <PendingLocationCard
              key={product.id}
              product={product}
              meta={[
                { icon: "grid", text: `Categoría: ${product.category}` },
                { icon: "box", text: `Stock: ${product.stockAvailable} unidades` },
              ]}
              estadoInline
              onAssign={openProductModal}
            />
          ))}
        </div>
      </section>

      <section className="stock-assignment__section">
        <h2 className="stock-assignment__section-title">
          Productos de restock pendientes de ubicación{" "}
          <span className="stock-assignment__section-count">
            ({filteredRestock.length})
          </span>
        </h2>
        <div className="stock-assignment__grid">
          {filteredRestock.map((product) => (
            <PendingLocationCard
              key={product.id}
              product={product}
              badge={{ variant: "success", label: "Restock aceptado" }}
              meta={[
                { icon: "file", text: `Orden: ${product.orderId}` },
                { icon: "box", text: `${product.received} unidades` },
                { icon: "calendar", text: `Recepción: ${product.receivedAt}` },
              ]}
              onAssign={openRestockModal}
            />
          ))}
        </div>
      </section>

      <ProductLocationModal
        open={productModalOpen}
        onClose={closeProductModal}
        product={selectedProduct}
      />

      <LocationAssignmentModal
        open={restockModalOpen}
        onClose={closeRestockModal}
        product={selectedRestock}
      />
    </div>
  );
}