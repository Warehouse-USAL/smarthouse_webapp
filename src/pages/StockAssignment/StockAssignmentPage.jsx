import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import TablePanel, { TablePanelTable } from "../../components/ui/TablePanel/TablePanel";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import Spinner from "../../components/ui/Spinner/Spinner";
import Icon from "../../components/ui/Icon/Icon";
import ProductLocationModal from "../../components/stock/ProductLocationModal/ProductLocationModal";
import LocateReceptionModal from "../../components/stock/LocateReceptionModal/LocateReceptionModal";
import { productService } from "../../services/productService";
import { restockService, restockOrderCode } from "../../services/restockService";
import "./StockAssignmentPage.css";

const matchesSearch = (item, q) =>
  !q ||
  item.name.toLowerCase().includes(q) ||
  item.sku.toLowerCase().includes(q);

export default function StockAssignmentPage() {
  const [productSearch, setProductSearch] = useState("");
  const [restockSearch, setRestockSearch] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [locateReception, setLocateReception] = useState(null);

  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
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
      // listAll pagina de verdad: list({size:200}) lo clampea el backend a 50
      // y los productos fuera de esa página no se cruzaban con las recepciones.
      const [list, pending] = await Promise.all([
        productService.listAll(),
        restockService.listPendingLocation(),
      ]);
      const byId = new Map(list.map((p) => [p.id, p]));
      setAllProducts(list);
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
            // La recepción cruda va completa: LocateReceptionModal necesita
            // productId, deliveryUnit, quantityPendingLocation, etc.
            ...reception,
            name: product?.name ?? "Producto dado de baja",
            sku: product?.sku ?? reception.productId,
            // La tabla lee imageUrl del producto; sin este cruce la fila
            // mostraría el placeholder en lugar de la foto.
            imageUrl: product?.imageUrl ?? "",
            orderId: reception.restockOrderId
              ? restockOrderCode(reception.restockOrderId)
              : "Sin orden",
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
    const q = productSearch.trim().toLowerCase();
    return products.filter((item) => matchesSearch(item, q));
  }, [products, productSearch]);

  const filteredRestock = useMemo(() => {
    const q = restockSearch.trim().toLowerCase();
    return pendingRestock.filter((item) => matchesSearch(item, q));
  }, [pendingRestock, restockSearch]);

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductModalOpen(false);
  };

  // Carga y error son compartidos: las dos tablas salen del mismo `load`.
  const renderStatus = () => {
    if (productsError) {
      return (
        <EmptyState
          icon="info"
          title="Algo salió mal"
          description={productsError}
          action={<Button variant="secondary" onClick={load}>Reintentar</Button>}
        />
      );
    }
    if (loadingProducts && products.length === 0 && pendingRestock.length === 0) {
      return (
        <div className="table-panel__loading">
          <Spinner label="Cargando productos…" />
        </div>
      );
    }
    return null;
  };

  const renderProductCell = (item) => (
    <div className="table-panel__product">
      <span className="table-panel__thumb">
        <Icon name="box" size={18} />
        {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
      </span>
      <span className="table-panel__product-name" title={item.name}>
        {item.name}
      </span>
    </div>
  );

  return (
    <div className="stock-assignment">
      <PageHeader
        title="Asignación de ubicación"
        subtitle="Productos nuevos y de restock pendientes de ubicación. Asigná una ubicación disponible para cada uno."
      />

      <TablePanel
        title="Productos sin ubicación asignada"
        count={`(${loadingProducts ? "…" : filteredProducts.length})`}
        search={{
          placeholder: "Buscar por nombre o SKU",
          value: productSearch,
          onChange: (e) => setProductSearch(e.target.value),
        }}
      >
        {renderStatus() ??
          (filteredProducts.length === 0 ? (
            <EmptyState
              icon="box"
              title="Sin productos"
              description="No hay productos sin ubicación asignada."
            />
          ) : (
            <TablePanelTable>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Stock disponible</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{renderProductCell(product)}</td>
                    <td>{product.sku}</td>
                    <td>{product.category}</td>
                    <td>{product.availableStock} unidades</td>
                    <td>
                      <Badge variant="warning" dot>Pendiente de ubicación</Badge>
                    </td>
                    <td>
                      <Button
                        variant="warning-outline"
                        size="sm"
                        iconLeft={<Icon name="pin" size={14} />}
                        onClick={() => openProductModal(product)}
                      >
                        Asignar ubicación
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablePanelTable>
          ))}
      </TablePanel>

      <TablePanel
        title="Productos de restock pendientes de ubicación"
        count={`(${loadingProducts ? "…" : filteredRestock.length})`}
        search={{
          placeholder: "Buscar por nombre o SKU",
          value: restockSearch,
          onChange: (e) => setRestockSearch(e.target.value),
        }}
      >
        {renderStatus() ??
          (filteredRestock.length === 0 ? (
            <EmptyState
              icon="box"
              title="Sin productos"
              description="No hay productos de restock pendientes de ubicación."
            />
          ) : (
            <TablePanelTable>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Orden</th>
                  <th>Cantidad pendiente</th>
                  <th>Fecha recepción</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestock.map((product) => (
                  <tr key={product.id}>
                    <td>{renderProductCell(product)}</td>
                    <td>{product.sku}</td>
                    <td>{product.orderId}</td>
                    <td>{product.received} unidades</td>
                    <td>{product.receivedAt}</td>
                    <td>
                      <Badge variant="success" dot>Restock aceptado</Badge>
                    </td>
                    <td>
                      <Button
                        variant="warning-outline"
                        size="sm"
                        iconLeft={<Icon name="pin" size={14} />}
                        onClick={() => setLocateReception(product)}
                      >
                        Ubicar mercadería
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablePanelTable>
          ))}
      </TablePanel>

      <ProductLocationModal
        open={productModalOpen}
        onClose={closeProductModal}
        onAssigned={load}
        product={selectedProduct}
      />

      <LocateReceptionModal
        open={locateReception !== null}
        receptions={locateReception ? [locateReception] : []}
        products={allProducts}
        onClose={() => setLocateReception(null)}
        onLocated={load}
      />
    </div>
  );
}