import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import ActionCard from "../../components/ui/ActionCard/ActionCard";
import Button from "../../components/ui/Button/Button";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import Icon from "../../components/ui/Icon/Icon";
import TablePanel, { TablePanelTable } from "../../components/ui/TablePanel/TablePanel";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import LoadError from "../../components/ui/LoadError/LoadError";
import Pagination from "../../components/ui/Pagination/Pagination";
import Modal from "../../components/ui/Modal/Modal";
import Badge from "../../components/ui/Badge/Badge";
import CreateProductForm from "../../components/products/CreateProductForm/CreateProductForm";
import RestockOrderModal from "../../components/stock/RestockOrderModal/RestockOrderModal";
import StatusBanner from "../../components/ui/StatusBanner/StatusBanner";
import { productService, searchFieldFor } from "../../services/productService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { stockAdjustmentService } from "../../services/stockAdjustmentService";
import {
  orderService,
  mapOrderStatus,
  normalizeCancelledOrder,
} from "../../services/orderService";
import { getUser } from "../../services/authService";
import { errorText } from "../../lib/apiError";
import { can } from "../../lib/permissions";
import { fromStoredRestock, needsRestock, toRestockAlert } from "../../lib/restockSuggestion";
import { displayCode } from "../../lib/pagination";
import "./ProductsPage.css";

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

// Tipos de ajuste manual. "conteo" setea el valor final absoluto; el resto
// son deltas (+/-) sobre el stock de la posición.
const ADJUST_TYPES = [
  { value: "entrada", label: "Entrada (+)" },
  { value: "merma", label: "Merma (-)" },
  { value: "rotura", label: "Rotura (-)" },
  { value: "vencimiento", label: "Vencimiento (-)" },
  { value: "conteo", label: "Conteo (stock final)" },
];

// Etiquetas del enum StockAdjustmentType que devuelve el backend en el historial.
const ADJUSTMENT_TYPE_LABEL = {
  MANUAL_INCREASE: "Entrada manual",
  MANUAL_DECREASE: "Baja manual",
  DAMAGE: "Rotura / daño",
  UNASSIGNED: "Producto desasignado",
  DEACTIVATED: "Posición desactivada",
};

const HISTORY_PAGE_SIZE = 10;

// Valor del filtro de ubicación para "Sin ubicación" (no choca con un zoneCode).
const NO_LOCATION = "__sin_ubicacion__";


const ACTIVE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];

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

// Precio desde centavos (contrato): 1700000 → "17.000,00".
const formatPrice = (price) => {
  if (!price || price.amount_cents == null) return "—";
  return (price.amount_cents / 100).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Texto completo de una ubicación para el tooltip ("Zona A · L01 · P02").
const fullLocationLabel = (loc) => {
  if (!loc) return "";
  const parts = [];
  if (loc.zoneCode) parts.push(`Zona ${loc.zoneCode}`);
  if (loc.numberLine != null)
    parts.push(`L${String(loc.numberLine).padStart(2, "0")}`);
  if (loc.positionName) parts.push(loc.positionName);
  return parts.join(" · ");
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(null);
  const [zones, setZones] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  // "" = todas, NO_LOCATION = sin ubicación, o el zoneCode de una zona.
  const [locationFilter, setLocationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  // Eliminación en dos pasos: 1 = aviso, 2 = confirmación final.
  const [deleteStep, setDeleteStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Ajuste manual de stock (PATCH /warehouse/positions/:id con current_stock).
  const [adjusting, setAdjusting] = useState(null);
  const [adjustPosition, setAdjustPosition] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  // Resultado de una reducción: { cancelled, notCancelled } de failShortOfStock.
  const [reductionResult, setReductionResult] = useState(null);

  // Historial/auditoría de ajustes (GET /products/:id/stock-adjustments).
  const [historyProduct, setHistoryProduct] = useState(null);

  // Orden de restock desde la fila: el producto ya viene elegido. Si la corrida
  // diaria calculó una sugerida, se precarga; si no, la cantidad arranca vacía.
  const [restockAlert, setRestockAlert] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyResult, setHistoryResult] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const currentUser = useMemo(() => getUser(), []);

  // Permisos del rol actual (espejo del backend): crear/editar incluye a
  // ADMIN_SALES, borrar no; asignar stock es solo de warehouse.
  const canCreate = can("product.create");
  const canEdit = can("product.edit");
  const canDelete = can("product.delete");
  const canAssignStock = can("stock.assign");
  const canViewStockHistory = can("stock.history");
  const canCreateRestock = can("restock.create");
  // Filtrar por zona / sin ubicación necesita GET /warehouse/positions.
  const canFilterLocation = can("warehouse.read");


  // Carga de categorías — async para que sea intercambiable con el backend real
  useEffect(() => {
    let cancelled = false;
    productService.getCategories().then((list) => {
      if (!cancelled) setCategories(list);
    });
    return () => { cancelled = true; };
  }, []);

  // Carga de zonas para el filtro (solo roles que ven el warehouse)
  useEffect(() => {
    if (!canFilterLocation) return undefined;
    let cancelled = false;
    warehouseConfigService.get().then((data) => {
      if (!cancelled) setZones(data.zones || []);
    });
    return () => { cancelled = true; };
  }, [canFilterLocation]);

  // Solo se muestra la respuesta del último pedido: cambiar de página o de
  // filtro rápido no puede pisar la tabla con una respuesta vieja.
  const lastRequest = useRef(0);

  // Carga de la página visible. Paginación en el servidor (productService.listPage):
  // se piden solo las filas de la página y sus ubicaciones.
  const fetchProducts = useCallback(async () => {
    const requestId = ++lastRequest.current;
    setLoading(true);
    setError(null);
    try {
      const searchText = search.trim();
      const filters = {
        page,
        size: pageSize,
        searchField: searchFieldFor(searchText),
        search: searchText || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      };
      if (locationFilter) {
        // Zona / sin ubicación: el backend no filtra productos por ubicación,
        // así que se resuelve a una lista de ids con las posiciones.
        const zonesByProduct = await warehouseConfigService.getProductZones();
        if (locationFilter === NO_LOCATION) {
          filters.excludeIds = [...zonesByProduct.keys()];
        } else {
          filters.includeIds = [...zonesByProduct]
            .filter(([, productZones]) => productZones.has(locationFilter))
            .map(([productId]) => productId);
        }
      }
      const result = await productService.listPage(filters);
      // GET /products/:id no trae ubicación; se consulta aparte para las filas
      // visibles. Un producto puede estar en varias.
      const withLocations = await Promise.all(
        result.items.map(async (p) => {
          const locations = await productService.getLocations(p.id).catch(() => []);
          return { ...p, locations, location: locations[0] ?? null };
        })
      );
      if (requestId !== lastRequest.current) return;
      // Tras eliminar puede quedar una página menos: se vuelve a la última.
      if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
        return;
      }
      setProducts(withLocations);
      setTotalPages(Math.max(1, result.totalPages));
      setTotalElements(result.totalElements);
    } catch (err) {
      if (requestId !== lastRequest.current) return;
      // Los límites del filtro por ubicación llegan como Error propio, con su
      // explicación; un fallo del backend muestra el aviso genérico de conexión.
      setError(err.isAxiosError ? true : err.message || true);
    } finally {
      if (requestId === lastRequest.current) setLoading(false);
    }
  }, [page, pageSize, search, categoryFilter, activeFilter, locationFilter]);

  // Contador de la tarjeta "Asignar stock": productos activos sin ubicación.
  const fetchUnassignedCount = useCallback(async () => {
    if (!canAssignStock) return;
    try {
      const zonesByProduct = await warehouseConfigService.getProductZones();
      setUnassignedCount(
        await productService.count({ active: true, excludeIds: [...zonesByProduct.keys()] })
      );
    } catch {
      setUnassignedCount(null);
    }
  }, [canAssignStock]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga del contador contra el backend
    fetchUnassignedCount();
  }, [fetchUnassignedCount]);

  // Tras crear, editar, eliminar o ajustar: la página y el contador.
  const reloadProducts = () => Promise.all([fetchProducts(), fetchUnassignedCount()]);

  useEffect(() => {
    let cancelled = false;
    // fetchProducts sets loading/error synchronously to drive the fetch UI;
    // that's intentional here (data load on mount + filter change), not the
    // render-derived cascade this rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts().catch(() => {
      if (!cancelled) { /* error ya manejado en fetchProducts */ }
    });
    return () => { cancelled = true; };
  }, [fetchProducts]);

  // Historial del producto abierto en el modal. Se recarga al cambiar de página.
  useEffect(() => {
    if (!historyProduct) return undefined;
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga del historial contra el backend
    setHistoryLoading(true);
    setHistoryError(null);
    stockAdjustmentService
      .listProductAdjustments(historyProduct.id, {
        page: historyPage,
        size: HISTORY_PAGE_SIZE,
      })
      .then((result) => {
        if (!stale) setHistoryResult(result);
      })
      .catch(() => {
        if (!stale) {
          setHistoryResult(null);
          setHistoryError(true);
        }
      })
      .finally(() => {
        if (!stale) setHistoryLoading(false);
      });
    return () => { stale = true; };
  }, [historyProduct, historyPage]);

  const pageStart = (page - 1) * pageSize;

  // zone_code es la clave del contrato; no hay campo "name" en Zone
  const locationOptions = useMemo(
    () => [
      { value: "", label: "Todas" },
      { value: NO_LOCATION, label: "Sin ubicación" },
      ...zones.map((z) => ({
        value: z.zoneCode,
        label: `Zona ${z.zoneCode}`,
      })),
    ],
    [zones]
  );

  // categoryService ya entrega { value, label } (espejo del enum del backend).
  const categoryOptions = useMemo(
    () => [{ value: "", label: "Todas las categorías" }, ...categories],
    [categories]
  );

  const handleCreate = async (values) => {
    setSubmitting(true);
    try {
      await productService.create(values);
      setCreateOpen(false);
      await reloadProducts();
    } catch (err) {
      alert(
        err.response?.data?.error?.message ||
        "No pudimos crear el producto."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await productService.update(editing.id, values);
      setEditing(null);
      await reloadProducts();
    } catch (err) {
      alert(
        err.response?.data?.error?.message ||
        "No pudimos actualizar el producto."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await productService.remove(deleting.id);
      setDeleting(null);
      setDeleteStep(1);
      await reloadProducts();
    } catch (err) {
      alert(
        err.response?.data?.error?.message ||
        "No pudimos eliminar el producto."
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const startDelete = (product) => {
    setDeleting(product);
    setDeleteStep(1);
  };

  const closeDelete = () => {
    if (!deleteSubmitting) {
      setDeleting(null);
      setDeleteStep(1);
    }
  };

  const openAdjust = (product) => {
    setAdjusting(product);
    setAdjustPosition(product.locations?.[0]?.idPosition ?? "");
    setAdjustType("entrada");
    setAdjustQty("");
    setAdjustReason("");
  };

  const openHistory = (product) => {
    setHistoryProduct(product);
    setHistoryPage(1);
    setHistoryResult(null);
    setHistoryError(null);
  };

  const closeHistory = () => {
    setHistoryProduct(null);
    setHistoryResult(null);
    setHistoryError(null);
  };

  // El backend devuelve el id del usuario. Solo podemos resolver el nombre del
  // usuario actual (no hay endpoint de usuarios accesible para warehouse).
  const actorLabel = (adjustedBy) => {
    if (!adjustedBy) return "—";
    if (adjustedBy === "system") return "Sistema";
    if (currentUser?.id && adjustedBy === currentUser.id) {
      return currentUser.name || currentUser.email || adjustedBy;
    }
    return adjustedBy;
  };

  const adjustLocations = adjusting?.locations ?? [];
  const adjustLocation =
    adjustLocations.find((loc) => loc.idPosition === adjustPosition) ?? null;
  const adjustCurrent = adjustLocation?.currentStock ?? 0;

  // Stock resultante del ajuste + validación previa al PATCH. Sin cantidad
  // cargada no hay error (el botón queda deshabilitado hasta que haya un next).
  // Una reducción puede dejar el stock por debajo de la reserva o del mínimo:
  // registra una pérdida real. El backend solo rechaza superar la capacidad
  // de la posición (400), que se muestra en el alert del handleAdjust.
  const computeAdjust = () => {
    if (adjustQty === "") return { next: null };
    const qty = Number(adjustQty);
    if (adjustType === "conteo" && (!Number.isInteger(qty) || qty < 0)) {
      return { next: null, error: "Ingresá una cantidad entera mayor o igual a 0." };
    }
    if (adjustType !== "conteo" && (!Number.isInteger(qty) || qty <= 0)) {
      return { next: null, error: "Ingresá una cantidad entera mayor a 0." };
    }
    const decreasing =
      adjustType === "merma" || adjustType === "rotura" || adjustType === "vencimiento";
    if (decreasing && qty > adjustCurrent) {
      return {
        next: null,
        error: `La cantidad supera el stock actual (${adjustCurrent} un.).`,
      };
    }
    const next =
      adjustType === "entrada"
        ? adjustCurrent + qty
        : adjustType === "conteo"
          ? qty
          : adjustCurrent - qty;
    return { next };
  };

  const adjustResult = computeAdjust();

  const handleAdjust = async () => {
    if (!adjustLocation) return;
    const { next, error } = computeAdjust();
    if (error || next == null) return;
    setAdjustSubmitting(true);
    const typeLabel = ADJUST_TYPES.find((t) => t.value === adjustType).label;
    // Motivo escrito por el operador; si lo deja vacío, se guarda un resumen
    // automático para que el historial nunca quede sin contexto.
    const typedReason = adjustReason.trim();
    const reason = typedReason
      ? `${typeLabel}: ${typedReason}`
      : `Ajuste manual "${typeLabel}" de ${adjusting.sku} ` +
        `en ${fullLocationLabel(adjustLocation)}: ${adjustCurrent} → ${next} un.`;
    let response;
    try {
      // El backend recalcula físico/reserva/disponible del producto desde las
      // posiciones; el solo hecho de setear acá el stock es el ajuste.
      response = await warehouseConfigService.updatePosition(
        adjustLocation.idZone,
        adjustLocation.idLine,
        adjustLocation.idPosition,
        { currentStock: next, reason }
      );
    } catch (err) {
      alert(errorText(err, {}, "No pudimos aplicar el ajuste de stock."));
      setAdjustSubmitting(false);
      return;
    }
    try {
      if (next < adjustCurrent && Array.isArray(response?.cancelled_orders)) {
        // Backend nuevo: ya reconcilió los pedidos en la misma transacción y
        // devuelve cuáles canceló (puede ser []). No se cancela nada acá.
        setReductionResult({
          cancelled: response.cancelled_orders.map(normalizeCancelledOrder),
          notCancelled: [],
        });
      } else if (next < adjustCurrent) {
        // Backend viejo (la respuesta no trae `cancelled_orders`): se cancelan
        // desde el cliente.
        // Releído tras el PATCH: otras posiciones pudieron cambiar desde que
        // se cargó la página (ajustes de otro usuario, órdenes completadas).
        const physicalStock = (await productService.getLocations(adjusting.id)).reduce(
          (sum, loc) => sum + loc.currentStock,
          0
        );
        setReductionResult(
          await orderService.failShortOfStock({
            productId: adjusting.id,
            physicalStock,
            reason: `INSUFFICIENT_STOCK: ${reason}`,
          })
        );
      }
      setAdjusting(null);
      await reloadProducts();
    } catch (err) {
      alert(
        "El ajuste de stock se registró, pero no pudimos actualizar las órdenes de compra afectadas: " +
          (err.response?.data?.error?.message || err.message)
      );
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const categoryLabel = (value) =>
    categories.find((c) => c.value === value)?.label ?? value ?? "—";

  return (
    <div className="products-page">
      <PageHeader
        title="Productos"
        subtitle="Gestioná el catálogo. La asignación de stock a posiciones se hace desde la pantalla Asignación de stock."
      />

      {(canCreate || canAssignStock) && (
        <div className="action-card-grid">
          {canCreate && (
            <ActionCard
              icon="plus"
              title="Dar de alta producto"
              description="Registrá un producto nuevo en el catálogo."
              note="Después podés asignarle una ubicación en el warehouse."
              variant="yellow"
              onClick={() => setCreateOpen(true)}
            />
          )}
          {canAssignStock && (
            <ActionCard
              icon="pin"
              title="Asignar stock"
              description="Ubicá los productos nuevos y la mercadería de restock."
              note={
                unassignedCount === null
                  ? null
                  : unassignedCount === 0
                    ? "Todos los productos tienen ubicación."
                    : `${unassignedCount} producto${unassignedCount === 1 ? "" : "s"} sin ubicación.`
              }
              variant="blue"
              onClick={() => navigate("/asignacion-stock")}
            />
          )}
        </div>
      )}

      {feedback && (
        <StatusBanner
          statusBannerState="status-banner-exito"
          icon={<Icon name="check" size={16} />}
          text={feedback}
        />
      )}

      <TablePanel
        search={{
          placeholder: "Buscar por nombre o SKU",
          value: search,
          onChange: (e) => { setSearch(e.target.value); setPage(1); },
        }}
        filtersClassName="table-panel__filters--auto"
        filters={
          <>
            <Select
              label="Activo"
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              options={ACTIVE_OPTIONS}
            />
            {canFilterLocation && (
              <Select
                label="Ubicación"
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
                options={locationOptions}
              />
            )}
            <Select
              label="Categoría"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              options={categoryOptions}
            />
          </>
        }
        footer={
          !loading && !error && products.length > 0 && (
            <>
              <span className="table-panel__showing">
                Mostrando {pageStart + 1} a{" "}
                {Math.min(pageStart + pageSize, totalElements)} de{" "}
                {totalElements} productos
              </span>
              <Pagination current={page} total={totalPages} onChange={setPage} />
              <Select
                value={String(pageSize)}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                options={PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }
      >
      {loading ? (
        <div className="table-panel__loading">
          <Spinner label="Cargando productos…" />
        </div>
      ) : error ? (
        <LoadError
          description={typeof error === "string" ? error : undefined}
          onRetry={fetchProducts}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="box"
          title="No hay productos"
          description="No encontramos productos con los filtros seleccionados."
          action={
            canCreate ? (
              <Button
                iconLeft={<Icon name="plus" size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                Dar de alta producto
              </Button>
            ) : null
          }
        />
      ) : (
          <TablePanelTable className="products-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Ubicación</th>
                <th>Reponer</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const first = product.location;
                const firstLabel = first
                  ? [first.zoneCode, first.positionName].filter(Boolean).join(" · ")
                  : "";
                const underMinimum = needsRestock(product);
                return (
                  <tr key={product.id || product.sku}>
                    <td data-label="Imagen" className="products-table__img">
                      <span className="products-table__thumb">
                        <Icon name="box" size={20} />
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" loading="lazy" />
                        )}
                      </span>
                    </td>
                    <td data-label="SKU" className="products-table__sku">
                      {product.sku}
                    </td>
                    <td data-label="Nombre" className="products-table__name">
                      {product.name}
                      {!product.active && (
                        <>
                          {" "}
                          <Badge variant="neutral">Inactivo</Badge>
                        </>
                      )}
                    </td>
                    <td data-label="Categoría">{categoryLabel(product.category)}</td>
                    <td data-label="Precio" className="products-table__num">
                      ${formatPrice(product.price)}
                    </td>
                    <td
                      data-label="Stock"
                      className="products-table__num"
                      title="Disponible = Stock físico − Stock reservado"
                    >
                      <span className="products-table__stock">
                        <span>
                          {product.availableStock}{" "}
                          <span className="products-table__unit">disponibles</span>
                        </span>
                        <span className="products-table__stock-detail">
                          Físico {product.stock?.physical ?? 0} · Reservado {product.reservedStock}
                        </span>
                      </span>
                    </td>
                    <td data-label="Ubicación" className="products-table__loc">
                      {first ? (
                        <span title={fullLocationLabel(first)}>
                          {firstLabel}
                          {product.locations.length > 1 && (
                            <span className="products-table__loc-more">
                              {" "}
                              +{product.locations.length - 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        "Sin asignar"
                      )}
                    </td>
                    <td
                      data-label="Reponer"
                      title={
                        product.reorderPoint != null
                          ? `Punto de reposición: ${product.reorderPoint} unidades`
                          : "Punto de reposición: sin calcular"
                      }
                    >
                      <Badge variant={underMinimum ? "danger" : "success"} dot>
                        {underMinimum ? "Sí" : "No"}
                      </Badge>
                    </td>
                    <td data-label="Acciones">
                      <div className="products-table__actions">
                        {canEdit && (
                          <button
                            type="button"
                            className="products-table__action"
                            onClick={() => setEditing(product)}
                            aria-label="Editar producto"
                            title="Editar"
                          >
                            <Icon name="edit" size={15} />
                          </button>
                        )}
                        {canAssignStock && product.locations?.length > 0 && (
                          <button
                            type="button"
                            className="products-table__action"
                            onClick={() => openAdjust(product)}
                            aria-label="Ajustar stock"
                            title="Ajustar stock"
                          >
                            <Icon name="target" size={15} />
                          </button>
                        )}
                        {canViewStockHistory && (
                          <button
                            type="button"
                            className="products-table__action"
                            onClick={() => openHistory(product)}
                            aria-label="Ver historial de ajustes"
                            title="Historial de ajustes"
                          >
                            <Icon name="list" size={15} />
                          </button>
                        )}
                        {canCreateRestock && product.active && (
                          <button
                            type="button"
                            className="products-table__action"
                            onClick={() => {
                              setFeedback(null);
                              setRestockAlert(fromStoredRestock(product) ?? toRestockAlert(product));
                            }}
                            aria-label="Generar orden de restock"
                            title="Generar orden de restock"
                          >
                            <Icon name="cart" size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="products-table__action products-table__action--danger"
                            onClick={() => startDelete(product)}
                            aria-label="Eliminar producto"
                            title="Eliminar"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TablePanelTable>
      )}
      </TablePanel>

      <Modal
        open={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        title="Dar de alta producto"
        size="lg"
      >
        <CreateProductForm
          categories={categories}
          submitting={submitting}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => !submitting && setEditing(null)}
        title="Editar producto"
        size="lg"
      >
        {editing && (
          <CreateProductForm
            categories={categories}
            submitting={submitting}
            onCancel={() => setEditing(null)}
            onSubmit={handleUpdate}
            initial={editing}
            mode="edit"
          />
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={closeDelete}
        title="Eliminar producto"
        size="sm"
        footer={
          deleteStep === 1 ? (
            <>
              <Button variant="secondary" onClick={closeDelete} disabled={deleteSubmitting}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => setDeleteStep(2)}
                disabled={deleteSubmitting}
              >
                Eliminar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setDeleteStep(1)}
                disabled={deleteSubmitting}
              >
                Volver
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? "Eliminando…" : "Sí, eliminar"}
              </Button>
            </>
          )
        }
      >
        {deleting && deleteStep === 1 && (
          <p className="products-page__delete-text">
            ¿Seguro que querés eliminar{" "}
            <strong>{deleting.name}</strong> (SKU: {deleting.sku})? Esta
            acción no se puede deshacer.
          </p>
        )}
        {deleting && deleteStep === 2 && (
          <p className="products-page__delete-text">
            Última confirmación: vas a eliminar definitivamente{" "}
            <strong>{deleting.name}</strong> (SKU: {deleting.sku}) del
            catálogo.
          </p>
        )}
      </Modal>

      <Modal
        open={!!adjusting}
        onClose={() => !adjustSubmitting && setAdjusting(null)}
        title="Ajustar stock"
        size="sm"
        footer={
          adjustLocations.length === 0 ? (
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setAdjusting(null)}
                disabled={adjustSubmitting}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleAdjust}
                disabled={
                  adjustSubmitting ||
                  adjustResult.next == null ||
                  !!adjustResult.error
                }
              >
                {adjustSubmitting ? "Aplicando…" : "Aplicar ajuste"}
              </Button>
            </>
          )
        }
      >
        {adjusting &&
          (adjustLocations.length === 0 ? (
            <p className="products-page__adjust-text">
              Este producto no tiene posiciones asignadas. El stock se carga
              desde la pantalla Asignación de stock.
            </p>
          ) : (
            <div className="products-page__adjust">
              <p className="products-page__adjust-product">
                <strong>{adjusting.name}</strong> · SKU {adjusting.sku}
              </p>
              <Select
                label="Posición"
                value={adjustPosition}
                onChange={(e) => setAdjustPosition(e.target.value)}
                options={adjustLocations.map((loc) => ({
                  value: loc.idPosition,
                  label: `${fullLocationLabel(loc)} (${loc.currentStock} un.)`,
                }))}
              />
              <Select
                label="Tipo de ajuste"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
                options={ADJUST_TYPES}
              />
              <Input
                label={
                  adjustType === "conteo" ? "Stock final contado" : "Cantidad de unidades"
                }
                type="number"
                min={0}
                step={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                error={adjustResult.error}
              />
              <Input
                label="Motivo (opcional)"
                type="text"
                placeholder="Ej. rotura de caja, conteo físico"
                maxLength={500}
                hint="Se guarda en el historial de ajustes."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
              <p className="products-page__adjust-preview">
                Stock actual: <strong>{adjustCurrent}</strong> → Stock
                resultante: <strong>{adjustResult.next ?? "—"}</strong>
              </p>
            </div>
          ))}
      </Modal>

      <Modal
        open={!!reductionResult}
        onClose={() => setReductionResult(null)}
        title="Reducción de stock registrada"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setReductionResult(null)}>
            Entendido
          </Button>
        }
      >
        {reductionResult &&
          (reductionResult.cancelled.length === 0 &&
          reductionResult.notCancelled.length === 0 ? (
            <p className="products-page__adjust-text">
              Reducción realizada sin problemas. No se vieron afectadas órdenes de compra.
            </p>
          ) : (
            <div className="products-page__adjust">
              <p className="products-page__adjust-text">
                Reducción realizada. Las siguientes órdenes de compra se ven afectadas
                porque el stock disponible es insuficiente para cumplir con los pedidos:
              </p>
              <ul className="products-page__failed-orders">
                {reductionResult.cancelled.map((order) => {
                  const status = mapOrderStatus(order);
                  return (
                    <li key={order.id} className="products-page__failed-order">
                      <span className="products-page__failed-order-info">
                        <strong>{order.code}</strong>
                        {order.cancelReason && (
                          <span className="products-page__failed-order-reason">
                            {order.cancelReason}
                          </span>
                        )}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
              {reductionResult.notCancelled.length > 0 && (
                <p className="products-page__adjust-text">
                  No pudimos pasar a Falla por stock:{" "}
                  <strong>
                    {reductionResult.notCancelled.map((order) => order.code).join(", ")}
                  </strong>
                  . Revisalas desde Ventas: pueden haber cambiado de estado.
                </p>
              )}
            </div>
          ))}
      </Modal>

      <Modal
        open={!!historyProduct}
        onClose={closeHistory}
        title={historyProduct ? `Historial de ajustes — ${historyProduct.name}` : ""}
        subtitle="Quién ajustó el stock, cuándo y por qué, en todas las posiciones del producto."
        size="lg"
        footer={
          <Button variant="secondary" onClick={closeHistory}>
            Cerrar
          </Button>
        }
      >
        {historyLoading ? (
          <div className="products-page__loading">
            <Spinner label="Cargando historial…" />
          </div>
        ) : historyError ? (
          <LoadError onRetry={() => setHistoryProduct({ ...historyProduct })} />
        ) : !historyResult || historyResult.items.length === 0 ? (
          <EmptyState
            icon="list"
            title="Sin ajustes registrados"
            description="Todavía no hay ajustes manuales de stock para este producto."
          />
        ) : (
          <>
            <div className="products-page__history-wrap">
              <table className="products-page__history">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                    <th>Cambio</th>
                    <th>Órdenes canceladas</th>
                  </tr>
                </thead>
                <tbody>
                  {historyResult.items.map((adjustment) => (
                    <tr key={adjustment.id}>
                      <td className="products-page__history-num">
                        {formatDateTime(adjustment.createdAt)}
                      </td>
                      <td>
                        {ADJUSTMENT_TYPE_LABEL[adjustment.type] ??
                          adjustment.type ??
                          "—"}
                      </td>
                      <td>{adjustment.reason || "—"}</td>
                      <td>{actorLabel(adjustment.adjustedBy)}</td>
                      <td className="products-page__history-num">
                        {adjustment.quantityBefore} → {adjustment.quantityAfter}
                      </td>
                      <td>
                        {adjustment.cancelledOrderIds.length > 0
                          ? adjustment.cancelledOrderIds
                              .map((id) => displayCode("OC", id))
                              .join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyResult.totalPages > 1 && (
              <div className="products-page__history-foot">
                <Pagination
                  current={historyPage}
                  total={historyResult.totalPages}
                  onChange={setHistoryPage}
                />
              </div>
            )}
          </>
        )}
      </Modal>
      <RestockOrderModal
        open={restockAlert !== null}
        alert={restockAlert}
        onClose={() => setRestockAlert(null)}
        onCreated={async () => {
          setFeedback("Orden de restock creada correctamente.");
          await reloadProducts();
        }}
      />
    </div>
  );
}