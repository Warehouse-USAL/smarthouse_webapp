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
import ProductCard from "../../components/products/ProductCard/ProductCard";
import CreateProductForm from "../../components/products/CreateProductForm/CreateProductForm";
import { productService } from "../../services/productService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import "./ProductsPage.css";

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

const STATUSES = [
  { value: "", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);


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
      const list = await productService.list({
        search: search || undefined,
        category: categoryFilter || undefined,
        isActive:
          status === "active" ? true :
            status === "inactive" ? false :
              undefined,
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
  }, [search, categoryFilter, status]);

  useEffect(() => {
    let cancelled = false;
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

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Todas las categorías" },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
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

  return (
    <div className="products-page">
      <PageHeader
        title="Productos"
        subtitle="Gestioná el catálogo. La asignación de stock a posiciones se hace desde la pantalla Asignación de stock."
        action={
          <div className="products-page__header-actions">
            <Link to="/asignacion-stock">
  <Button
    variant="secondary"
    size="sm"
    iconLeft={<Icon name="pin" size={14} />}
  >
    Asignar stock
  </Button>
</Link>
            <Button
              iconLeft={<Icon name="plus" size={16} />}
              onClick={() => setCreateOpen(true)}
            >
              Dar de alta producto
            </Button>
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
        <div className="products-page__filter">
          <Select
            label="Estado"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={STATUSES}
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
              <Button
                iconLeft={<Icon name="plus" size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                Dar de alta producto
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="products-page__grid">
          {pageItems.map((product) => (
            <ProductCard
              key={product.id || product.sku}
              product={product}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
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
        onClose={() => !deleteSubmitting && setDeleting(null)}
        title="Eliminar producto"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={deleteSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        {deleting && (
          <p className="products-page__delete-text">
            ¿Seguro que querés eliminar{" "}
            <strong>{deleting.name}</strong> (SKU: {deleting.sku})? Esta
            acción no se puede deshacer.
          </p>
        )}
      </Modal>
    </div>
  );
}