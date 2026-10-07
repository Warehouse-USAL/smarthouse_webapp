import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Button from "../../components/ui/Button/Button";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import Icon from "../../components/ui/Icon/Icon";
import Card from "../../components/ui/Card/Card";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import Pagination from "../../components/ui/Pagination/Pagination";
import Modal from "../../components/ui/Modal/Modal";
import Badge from "../../components/ui/Badge/Badge";
import CreateProductForm from "../../components/products/CreateProductForm/CreateProductForm";
import { productService } from "../../services/productService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { can } from "../../lib/permissions";
import { needsRestock } from "../../lib/restockSuggestion";
import "./ProductsPage.css";

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

// Tipos de ajuste manual. "conteo" setea el valor final absoluto; el resto
// son deltas (+/-) sobre el stock de la posición. El motivo/auditoría no
// existe en el backend (UpdatePositionRequest no tiene campo), así que no se
// pide: queda documentado como gap en docs/sprint-gestion-ventas-stock.md §10.
const ADJUST_TYPES = [
  { value: "entrada", label: "Entrada (+)" },
  { value: "merma", label: "Merma (-)" },
  { value: "rotura", label: "Rotura (-)" },
  { value: "vencimiento", label: "Vencimiento (-)" },
  { value: "conteo", label: "Conteo (stock final)" },
];

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
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
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
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Permisos del rol actual (espejo del backend): crear/editar incluye a
  // ADMIN_SALES, borrar no; asignar stock es solo de warehouse.
  const canCreate = can("product.create");
  const canEdit = can("product.edit");
  const canDelete = can("product.delete");
  const canAssignStock = can("stock.assign");


  // Carga de categorías — async para que sea intercambiable con el backend real
  useEffect(() => {
    let cancelled = false;
    productService.getCategories().then((list) => {
      if (!cancelled) setCategories(list);
    });
    return () => { cancelled = true; };
  }, []);

  // Carga de zonas para el filtro
  useEffect(() => {
    let cancelled = false;
    warehouseConfigService.get().then((data) => {
      if (!cancelled) setZones(data.zones || []);
    });
    return () => { cancelled = true; };
  }, []);

  // Carga de productos — se re-ejecuta cuando cambian los filtros de API
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No filtramos por estado: se listan tanto activos como inactivos.
      const list = await productService.list({
        search: search || undefined,
        category: categoryFilter || undefined,
      });
      // GET /products no trae ubicación; se consulta aparte por producto para
      // poder filtrar por zona en cliente. Un producto puede estar en varias.
      const withLocations = await Promise.all(
        list.map(async (p) => {
          const locations = await productService.getLocations(p.id).catch(() => []);
          return { ...p, locations, location: locations[0] ?? null };
        })
      );
      setProducts(withLocations);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        "No pudimos cargar los productos."
      );
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

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

  // El filtro de zona se aplica en cliente porque el contrato no expone
  // un query param de zona en GET /products. Se compara contra zone_code de
  // cualquiera de las ubicaciones del producto.
  const filtered = useMemo(() => {
    if (!zone) return products;
    return products.filter((p) =>
      (p.locations ?? []).some((loc) => loc.zoneCode === zone)
    );
  }, [products, zone]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  // zone_code es la clave del contrato; no hay campo "name" en Zone
  const zoneOptions = useMemo(
    () => [
      { value: "", label: "Todas las zonas" },
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
  };

  const adjustLocations = adjusting?.locations ?? [];
  const adjustLocation =
    adjustLocations.find((loc) => loc.idPosition === adjustPosition) ?? null;
  const adjustCurrent = adjustLocation?.currentStock ?? 0;
  const adjustReserved = adjusting?.reservedStock ?? 0;

  // Stock resultante del ajuste + validación previa al PATCH. Sin cantidad
  // cargada no hay error (el botón queda deshabilitado hasta que haya un next).
  // El backend valida capacity/min por su lado y devuelve 400, que se muestra
  // en el alert del handleAdjust.
  const computeAdjust = () => {
    if (adjustQty === "") return { next: null };
    const qty = Number(adjustQty);
    if (!Number.isInteger(qty) || qty < 0) {
      return { next: null, error: "Ingresá una cantidad entera mayor o igual a 0." };
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
    if (next < adjustReserved) {
      return {
        next: null,
        error: `No puede quedar por debajo de la reserva (${adjustReserved} un. reservadas).`,
      };
    }
    return { next };
  };

  const adjustResult = computeAdjust();

  const handleAdjust = async () => {
    if (!adjustLocation) return;
    const { next, error } = computeAdjust();
    if (error || next == null) return;
    setAdjustSubmitting(true);
    try {
      // El backend recalcula físico/reserva/disponible del producto desde las
      // posiciones; el solo hecho de setear acá el stock es el ajuste.
      await warehouseConfigService.updatePosition(
        adjustLocation.idZone,
        adjustLocation.idLine,
        adjustLocation.idPosition,
        { currentStock: next }
      );
      setAdjusting(null);
      await fetchProducts();
    } catch (err) {
      alert(
        err.response?.data?.error?.message ||
          "No pudimos aplicar el ajuste de stock."
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
        action={
          <div className="products-page__header-actions">
            {canAssignStock && (
              <Link to="/asignacion-stock">
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Icon name="pin" size={14} />}
                >
                  Asignar stock
                </Button>
              </Link>
            )}
            {canCreate && (
              <Button
                iconLeft={<Icon name="plus" size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                Dar de alta producto
              </Button>
            )}
          </div>
        }
      />

      <div className="products-page__search">
        <Input
          placeholder="Buscar por nombre o SKU"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          iconLeft={<Icon name="search" size={16} />}
        />
      </div>

      <Card padding="md" className="products-page__filters">
        <div className="products-page__filter">
          <Select
            label="Zonas"
            value={zone}
            onChange={(e) => { setZone(e.target.value); setPage(1); }}
            options={zoneOptions}
          />
        </div>
        <div className="products-page__filter">
          <Select
            label="Categoría"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            options={categoryOptions}
          />
        </div>
      </Card>

      {loading ? (
        <div className="products-page__loading">
          <Spinner label="Cargando productos…" />
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            icon="info"
            title="Algo salió mal"
            description={error}
            action={
              <Button variant="secondary" onClick={fetchProducts}>
                Reintentar
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
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
        </Card>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Físico</th>
                <th>Reserva</th>
                <th>Disponible</th>
                <th>Mínimo</th>
                <th>Ubicación</th>
                <th>Reponer</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((product) => {
                const first = product.location;
                const firstLabel = first
                  ? [first.zoneCode, first.positionName].filter(Boolean).join(" · ")
                  : "";
                const underMinimum = needsRestock(product);
                return (
                  <tr key={product.id || product.sku}>
                    <td data-label="Imagen" className="products-table__img">
                      <span className="products-table__thumb">
                        <Icon name="box" size={16} />
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" loading="lazy" />
                        )}
                      </span>
                    </td>
                    <td data-label="SKU" className="products-table__sku">
                      {product.sku}
                    </td>
                    <td data-label="Nombre">
                      <span className="products-table__name" title={product.name}>
                        {product.name}
                      </span>
                    </td>
                    <td data-label="Categoría">{categoryLabel(product.category)}</td>
                    <td data-label="Precio" className="products-table__num">
                      ${formatPrice(product.price)}
                    </td>
                    <td data-label="Físico" className="products-table__num">
                      {product.stock?.physical ?? 0}
                    </td>
                    <td data-label="Reserva" className="products-table__num">
                      {product.reservedStock}
                    </td>
                    <td
                      data-label="Disponible"
                      className="products-table__num"
                      title="Disponible = Físico − Reserva"
                    >
                      {product.availableStock}
                    </td>
                    <td data-label="Mínimo" className="products-table__num">
                      {product.minimumStock}
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
                    <td data-label="Reponer">
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
          </table>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <footer className="products-page__footer">
          <span className="products-page__count">
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
              <p className="products-page__adjust-preview">
                Stock actual: <strong>{adjustCurrent}</strong> → Stock
                resultante: <strong>{adjustResult.next ?? "—"}</strong>
              </p>
            </div>
          ))}
      </Modal>
    </div>
  );
}