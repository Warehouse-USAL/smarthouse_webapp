import { useCallback, useEffect, useMemo, useState } from "react";
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
import LocateReceptionModal from "../../components/stock/LocateReceptionModal/LocateReceptionModal";
import { productService } from "../../services/productService";
import { restockService, restockOrderCode } from "../../services/restockService";
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
  // El stock entra siempre por un remito (con o sin orden de restock): esta
  // pantalla solo ubica la mercadería ya recibida. No hay alta de stock directa
  // a una posición, porque no tendría contrapartida.
  const [restockSearch, setRestockSearch] = useState("");
  const [restockPage, setRestockPage] = useState(1);
  const [restockPageSize, setRestockPageSize] = useState(5);
  const [locateReception, setLocateReception] = useState(null);

  // Remitos de restock sin ubicar (lista acotada, paginada acá).
  const [pendingRestock, setPendingRestock] = useState([]);
  const [restockProducts, setRestockProducts] = useState([]);
  const [loadingRestock, setLoadingRestock] = useState(true);
  const [restockError, setRestockError] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial contra el backend
    loadRestock();
  }, [loadRestock]);

  const filteredRestock = useMemo(() => {
    const q = restockSearch.trim().toLowerCase();
    return pendingRestock.filter((item) => matchesSearch(item, q));
  }, [pendingRestock, restockSearch]);

  const restockPageData = pageOf(filteredRestock, restockPage, restockPageSize);

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
        subtitle="Mercadería recibida con remito que todavía no tiene posición. Asigná una ubicación disponible para cada una."
      />

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
                        Ubicar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablePanelTable>
          ))}
      </TablePanel>

      <LocateReceptionModal
        open={locateReception !== null}
        receptions={locateReception ? [locateReception] : []}
        products={restockProducts}
        onClose={() => setLocateReception(null)}
        onLocated={loadRestock}
      />
    </div>
  );
}