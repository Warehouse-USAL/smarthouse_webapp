import { useCallback, useEffect, useMemo, useState } from "react";
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
import { categoryService } from "../../services/categoryService";
import "./ProductsPage.css";

const PAGE_SIZE_OPTIONS = [
  { value: "8", label: "8 por página" },
  { value: "16", label: "16 por página" },
  { value: "32", label: "32 por página" },
];

const ZONES = [
  { value: "", label: "Todas las zonas" },
  { value: "A", label: "Zona A" },
  { value: "B", label: "Zona B" },
  { value: "C", label: "Zona C" },
  { value: "D", label: "Zona D" },
];

const STATUSES = [
  { value: "", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [categories, setCategories] = useState(categoryService.list());
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await productService.list({
        search: search || undefined,
        category: categoryFilter || undefined,
        isActive: status === "active" ? true : status === "inactive" ? false : undefined,
      });
      setProducts(list);
    } catch (err) {
      setError(err.response?.data?.error?.message || "No pudimos cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await productService.list({
          search: search || undefined,
          category: categoryFilter || undefined,
          isActive: status === "active" ? true : status === "inactive" ? false : undefined,
        });
        if (!cancelled) setProducts(list);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "No pudimos cargar los productos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, categoryFilter, status]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (zone && p.zone !== zone) return false;
      return true;
    });
  }, [products, zone]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const categoryOptions = useMemo(
    () => [{ value: "", label: "Todas las categorías" }, ...categories.map((c) => ({ value: c, label: c }))],
    [categories]
  );

  const handleCreate = async (values) => {
    setSubmitting(true);
    try {
      await productService.create(values);
      if (!categories.includes(values.category)) {
        setCategories(categoryService.add(values.category));
      }
      setCreateOpen(false);
      await fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error?.message || "No pudimos crear el producto.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await productService.update(editing.id, values);
      if (!categories.includes(values.category)) {
        setCategories(categoryService.add(values.category));
      }
      setEditing(null);
      await fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error?.message || "No pudimos actualizar el producto.");
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
      alert(err.response?.data?.error?.message || "No pudimos eliminar el producto.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="products-page">
      <PageHeader
        title="Productos"
        subtitle="Gestioná el catálogo y visualizá la información de cada producto."
        action={
          <Button iconLeft={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
            Dar de alta producto
          </Button>
        }
      />

      <div className="products-page__search">
        <Input
          placeholder="Buscar por SKU"
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
            options={ZONES}
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
            action={<Button variant="secondary" onClick={fetchProducts}>Reintentar</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="box"
            title="No hay productos"
            description="No encontramos productos con los filtros seleccionados."
            action={
              <Button iconLeft={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
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
            Mostrando {pageStart + 1} a {Math.min(pageStart + pageSize, filtered.length)} de {filtered.length} productos
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
            ¿Seguro que querés eliminar <strong>{deleting.name}</strong> (SKU: {deleting.sku})?
            Esta acción no se puede deshacer.
          </p>
        )}
      </Modal>
    </div>
  );
}
