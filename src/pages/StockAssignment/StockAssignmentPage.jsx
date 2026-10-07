import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Input from "../../components/ui/Input/Input";
import Icon from "../../components/ui/Icon/Icon";
import PendingLocationCard from "../../components/stock/PendingLocationCard/PendingLocationCard";
import ProductLocationModal from "../../components/stock/ProductLocationModal/ProductLocationModal";
import LocationAssignmentModal from "../../components/stock/LocationAssignmentModal/LocationAssignmentModal";
import { productService } from "../../services/productService";
import { restockService } from "../../services/restockService";
import "./StockAssignmentPage.css";

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

  const [products, setProducts] = useState([]);
  const [pendingRestock, setPendingRestock] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);

  // Productos del catálogo sin ninguna ubicación asignada (locations vacío).
  // El listado del backend no trae ubicación, así que se consulta aparte.
  // Los remitos sin ubicar salen de listPendingLocation: contra un backend sin
  // esa capacidad vuelve vacío y la sección queda en estado vacío (correcto,
  // porque ahí tampoco se puede crear un remito sin ubicar).
  const load = useCallback(async () => {
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const [list, pending, orders] = await Promise.all([
        productService.list({ size: 200 }),
        restockService.listPendingLocation(),
        restockService.listOrdersWithProgress().catch(() => []),
      ]);
      const byId = new Map(list.map((p) => [p.id, p]));
      const orderCode = new Map(orders.map((o) => [o.id, o.code]));
      const withLocations = await Promise.all(
        list.map(async (product) => ({
          product,
          locations: await productService.getLocations(product.id),
        }))
      );
      setProducts(
        withLocations
          .filter((entry) => entry.locations.length === 0)
          .map((entry) => entry.product)
      );
      setPendingRestock(
        pending.map((reception) => {
          const product = byId.get(reception.productId);
          return {
            id: reception.id,
            name: product?.name ?? "Producto dado de baja",
            sku: product?.sku ?? reception.productId,
            orderId:
              orderCode.get(reception.restockOrderId) ??
              reception.restockOrderId ??
              "Sin orden",
            received: reception.quantityPendingLocation,
            receivedAt: reception.createdAt
              ? new Date(reception.createdAt).toLocaleDateString("es-AR")
              : "—",
          };
        })
      );
    } catch (err) {
      setProducts([]);
      setPendingRestock([]);
      setProductsError(
        err?.response?.data?.error?.message ||
          "No pudimos cargar los productos."
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    // load setea loading/error de forma síncrona para manejar la UI de carga;
    // es intencional, no el cascade derivado de render que esta regla previene.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => matchesSearch(item, q));
  }, [products, search]);

  const filteredRestock = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pendingRestock.filter((item) => matchesSearch(item, q));
  }, [pendingRestock, search]);

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

  const renderProducts = () => {
    if (productsError) {
      return (
        <p className="stock-assignment__status stock-assignment__status--error">
          {productsError}{" "}
          <button type="button" className="stock-assignment__retry" onClick={load}>
            Reintentar
          </button>
        </p>
      );
    }
    if (loadingProducts && products.length === 0) {
      return <p className="stock-assignment__status">Cargando productos…</p>;
    }
    if (filteredProducts.length === 0) {
      return <p className="stock-assignment__status">No hay productos sin ubicación asignada.</p>;
    }
    return (
      <div className="stock-assignment__grid">
        {filteredProducts.map((product) => (
          <PendingLocationCard
            key={product.id}
            product={product}
            meta={[
              { icon: "grid", text: `Categoría: ${product.category}` },
              { icon: "box", text: `Stock: ${product.availableStock} unidades` },
            ]}
            estadoInline
            onAssign={openProductModal}
          />
        ))}
      </div>
    );
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
            ({loadingProducts ? "…" : filteredProducts.length})
          </span>
        </h2>
        {renderProducts()}
      </section>

      <section className="stock-assignment__section">
        <h2 className="stock-assignment__section-title">
          Productos de restock pendientes de ubicación{" "}
          <span className="stock-assignment__section-count">
            ({filteredRestock.length})
          </span>
        </h2>
        <div className="stock-assignment__grid">
          {filteredRestock.length === 0 ? (
            <p className="stock-assignment__status">
              No hay productos de restock pendientes de ubicación.
            </p>
          ) : (
            filteredRestock.map((product) => (
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
            ))
          )}
        </div>
      </section>

      <ProductLocationModal
        open={productModalOpen}
        onClose={closeProductModal}
        onAssigned={load}
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