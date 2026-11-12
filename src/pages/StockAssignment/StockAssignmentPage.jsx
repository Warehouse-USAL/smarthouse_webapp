import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import TablePanel, { TablePanelTable } from "../../components/ui/TablePanel/TablePanel";
import Badge from "../../components/ui/Badge/Badge";
import Button from "../../components/ui/Button/Button";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import LoadError from "../../components/ui/LoadError/LoadError";
import Spinner from "../../components/ui/Spinner/Spinner";
import Icon from "../../components/ui/Icon/Icon";
import Pagination from "../../components/ui/Pagination/Pagination";
import Select from "../../components/ui/Select/Select";
import ProductLocationModal from "../../components/stock/ProductLocationModal/ProductLocationModal";
import LocateReceptionModal from "../../components/stock/LocateReceptionModal/LocateReceptionModal";
import { productService, searchFieldFor } from "../../services/productService";
import { restockService, restockOrderCode } from "../../services/restockService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { categoryLabel } from "../../services/categoryService";
import "./StockAssignmentPage.css";

const matchesSearch = (item, q) =>
  !q ||
  item.name.toLowerCase().includes(q) ||
  item.sku.toLowerCase().includes(q);

// Mismas opciones que las tablas de Gestión de stock.
const PAGE_SIZE_OPTIONS = [
  { value: "5", label: "5 por página" },
  { value: "10", label: "10 por página" },
  { value: "20", label: "20 por página" },
];

// Página visible de una lista ya filtrada (tabla de restock, que es acotada). Si la lista se achica (se ubicó un
// producto), la página se ajusta a la última que existe.
const pageOf = (rows, page, size) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  return { items: rows.slice(start, start + size), current, totalPages, start };
};

export default function StockAssignmentPage() {
  const [productSearch, setProductSearch] = useState("");
  const [restockSearch, setRestockSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(5);
  const [restockPage, setRestockPage] = useState(1);
  const [restockPageSize, setRestockPageSize] = useState(5);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [locateReception, setLocateReception] = useState(null);

  // Tabla 1: productos sin ubicación, paginados en el servidor.
  const [products, setProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(false);

  // Tabla 2: remitos de restock sin ubicar (lista acotada, paginada acá).
  const [pendingRestock, setPendingRestock] = useState([]);
  const [restockProducts, setRestockProducts] = useState([]);
  const [loadingRestock, setLoadingRestock] = useState(true);
  const [restockError, setRestockError] = useState(false);

  // Solo se muestra la respuesta del último pedido (cambios rápidos de página
  // o de búsqueda).
  const lastProductsRequest = useRef(0);

  // Productos activos sin ninguna posición: GET /warehouse/positions (1
  // request) dice cuáles tienen ubicación y POST /query/products trae solo la
  // página visible de los demás. No hace falta consultar la ubicación de cada
  // producto: si está en esta lista, no tiene.
  const loadProducts = useCallback(async () => {
    const requestId = ++lastProductsRequest.current;
    setLoadingProducts(true);
    setProductsError(false);
    try {
      const zonesByProduct = await warehouseConfigService.getProductZones();
      const searchText = productSearch.trim();
      const result = await productService.listPage({
        page: productPage,
        size: productPageSize,
        active: true,
        excludeIds: [...zonesByProduct.keys()],
        searchField: searchFieldFor(searchText),
        search: searchText || undefined,
      });
      if (requestId !== lastProductsRequest.current) return;
      // Tras ubicar puede quedar una página menos: se vuelve a la última.
      if (result.totalPages > 0 && productPage > result.totalPages) {
        setProductPage(result.totalPages);
        return;
      }
      setProducts(result.items);
      setProductsTotal(result.totalElements);
      setProductsTotalPages(Math.max(1, result.totalPages));
    } catch {
      if (requestId !== lastProductsRequest.current) return;
      setProducts([]);
      setProductsError(true);
    } finally {
      if (requestId === lastProductsRequest.current) setLoadingProducts(false);
    }
  }, [productPage, productPageSize, productSearch]);

  // Remitos sin ubicar (listPendingLocation: contra un backend sin esa
  // capacidad vuelve vacío y la sección queda en estado vacío). Solo se piden
  // los productos de esos remitos, no el catálogo entero.
  const loadRestock = useCallback(async () => {
    setLoadingRestock(true);
    setRestockError(false);
    try {
      const pending = await restockService.listPendingLocation();
      const productIds = [...new Set(pending.map((r) => r.productId))];
      // Un producto dado de baja responde 404: la fila lo indica.
      const fetched = await Promise.all(
        productIds.map((id) => productService.get(id).catch(() => null))
      );
      const byId = new Map(fetched.filter(Boolean).map((p) => [p.id, p]));
      setRestockProducts([...byId.values()]);
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
    } catch {
      setPendingRestock([]);
      setRestockError(true);
    } finally {
      setLoadingRestock(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de la página contra el backend
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial contra el backend
    loadRestock();
  }, [loadRestock]);

  // Tras ubicar algo cambian las dos tablas.
  const reload = () => Promise.all([loadProducts(), loadRestock()]);

  const filteredRestock = useMemo(() => {
    const q = restockSearch.trim().toLowerCase();
    return pendingRestock.filter((item) => matchesSearch(item, q));
  }, [pendingRestock, restockSearch]);

  const productStart = (productPage - 1) * productPageSize;
  const restockPageData = pageOf(filteredRestock, restockPage, restockPageSize);

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductModalOpen(false);
  };

  const loadingState = (
    <div className="table-panel__loading">
      <Spinner label="Cargando productos…" />
    </div>
  );

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

      <div className="table-panel-grid">
      <TablePanel
        title="Productos sin ubicación asignada"
        count={`(${loadingProducts ? "…" : productsTotal})`}
        search={{
          placeholder: "Buscar por nombre o SKU",
          value: productSearch,
          onChange: (e) => { setProductSearch(e.target.value); setProductPage(1); },
        }}
        footer={
          !loadingProducts && !productsError && products.length > 0 && (
            <>
              <span className="table-panel__showing">
                Mostrando {productStart + 1} a {productStart + products.length} de{" "}
                {productsTotal} productos
              </span>
              <Pagination
                current={productPage}
                total={productsTotalPages}
                onChange={setProductPage}
              />
              <Select
                value={String(productPageSize)}
                onChange={(e) => {
                  setProductPageSize(Number(e.target.value));
                  setProductPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }
      >
        {productsError ? (
          <LoadError onRetry={loadProducts} />
        ) : loadingProducts ? (
          loadingState
        ) : (
          products.length === 0 ? (
            <EmptyState
              icon="box"
              title="Sin productos"
              description="No hay productos sin ubicación asignada."
            />
          ) : (
            <TablePanelTable className="table-panel__table--compact">
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
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{renderProductCell(product)}</td>
                    <td className="table-panel__nowrap">{product.sku}</td>
                    <td>{categoryLabel(product.category)}</td>
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
        count={`(${loadingRestock ? "…" : filteredRestock.length})`}
        search={{
          placeholder: "Buscar por nombre o SKU",
          value: restockSearch,
          onChange: (e) => { setRestockSearch(e.target.value); setRestockPage(1); },
        }}
        footer={
          !loadingRestock && !restockError && filteredRestock.length > 0 && (
            <>
              <span className="table-panel__showing">
                Mostrando {restockPageData.start + 1} a{" "}
                {restockPageData.start + restockPageData.items.length} de{" "}
                {filteredRestock.length} productos
              </span>
              <Pagination
                current={restockPageData.current}
                total={restockPageData.totalPages}
                onChange={setRestockPage}
              />
              <Select
                value={String(restockPageSize)}
                onChange={(e) => {
                  setRestockPageSize(Number(e.target.value));
                  setRestockPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }
      >
        {restockError ? (
          <LoadError onRetry={loadRestock} />
        ) : loadingRestock ? (
          loadingState
        ) : (
          filteredRestock.length === 0 ? (
            <EmptyState
              icon="box"
              title="Sin productos"
              description="No hay productos de restock pendientes de ubicación."
            />
          ) : (
            <TablePanelTable className="table-panel__table--compact">
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
                {restockPageData.items.map((product) => (
                  <tr key={product.id}>
                    <td>{renderProductCell(product)}</td>
                    <td className="table-panel__nowrap">{product.sku}</td>
                    <td className="table-panel__nowrap">{product.orderId}</td>
                    <td>{product.received} unidades</td>
                    <td className="table-panel__nowrap">{product.receivedAt}</td>
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
      </div>

      <ProductLocationModal
        open={productModalOpen}
        onClose={closeProductModal}
        onAssigned={reload}
        product={selectedProduct}
      />

      <LocateReceptionModal
        open={locateReception !== null}
        receptions={locateReception ? [locateReception] : []}
        products={restockProducts}
        onClose={() => setLocateReception(null)}
        onLocated={reload}
      />
    </div>
  );
}