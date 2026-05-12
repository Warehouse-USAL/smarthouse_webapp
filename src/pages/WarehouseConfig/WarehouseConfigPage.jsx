import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Select from "../../components/ui/Select/Select";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import Icon from "../../components/ui/Icon/Icon";
import Spinner from "../../components/ui/Spinner/Spinner";
import ZoneGrid from "../../components/warehouse/ZoneGrid/ZoneGrid";
import InfoList from "../../components/warehouse/InfoList/InfoList";
import StructureEditForm from "../../components/warehouse/StructureEditForm/StructureEditForm";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { productService } from "../../services/productService";
import "./WarehouseConfigPage.css";

const range = (n) => Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, "0") }));

export default function WarehouseConfigPage() {
  const [config, setConfig] = useState(() => warehouseConfigService.get());
  const [selected, setSelected] = useState({ zone: "", line: "", height: "", position: "" });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    productService
      .list()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedZone = useMemo(
    () => config.zones.find((z) => z.id === selected.zone),
    [config, selected.zone]
  );

  const lineOptions = useMemo(
    () => (selectedZone ? range(selectedZone.lines) : []),
    [selectedZone]
  );
  const heightOptions = useMemo(
    () => (selectedZone ? range(selectedZone.heights) : []),
    [selectedZone]
  );
  const positionOptions = useMemo(
    () => (selectedZone ? range(selectedZone.positions) : []),
    [selectedZone]
  );

  const locationCode = warehouseConfigService.buildLocationCode(selected);

  const matchingProduct = useMemo(() => {
    if (!selected.zone || !selected.line || !selected.position) return null;
    return products.find(
      (p) =>
        p.zone === selected.zone &&
        String(p.line) === String(selected.line) &&
        String(p.position) === String(selected.position) &&
        (selected.height ? String(p.height) === String(selected.height) : true)
    );
  }, [products, selected]);

  const handleSelectFromMap = ({ zone, line, position }) => {
    setSelected((prev) => ({
      zone,
      line: String(line),
      position: String(position),
      height: prev.zone === zone ? prev.height : "",
    }));
  };

  const handleSaveStructure = (draft) => {
    const next = {
      ...config,
      zones: config.zones.map((z) => ({ ...z, ...draft[z.id] })),
    };
    warehouseConfigService.save(next);
    setConfig(next);
    setEditing(null);
  };

  const locationInfo = [
    { label: "Código de la ubicación", value: locationCode },
    { label: "Categoría permitida", value: matchingProduct?.category },
    { label: "Capacidad máxima", value: matchingProduct?.maxQuantityPerOrder },
    { label: "Stock actual", value: matchingProduct?.availableStock },
  ];

  const productInfo = [
    { label: "Nombre", value: matchingProduct?.name },
    { label: "Código", value: matchingProduct?.sku },
    { label: "Stock actual", value: matchingProduct?.availableStock },
    { label: "Punto de reposición", value: matchingProduct?.minStock },
    { label: "Categoría", value: matchingProduct?.category },
  ];

  return (
    <div className="warehouse-page">
      <PageHeader
        title="Configuración del warehouse"
        subtitle="Visualizá el mapa de zonas y definí la ubicación jerárquica de cada producto."
      />

      <div className="warehouse-page__layout">
        <Card padding="lg" className="warehouse-page__map">
          <CardHeader icon={<Icon name="map" size={16} />} title="Mapa del warehouse" />
          {loading ? (
            <Spinner label="Cargando…" />
          ) : (
            <>
              <div className="warehouse-page__grids">
                {config.zones.map((zone) => (
                  <ZoneGrid
                    key={zone.id}
                    zone={zone}
                    selected={selected}
                    onSelect={handleSelectFromMap}
                  />
                ))}
              </div>
              <div className="warehouse-page__legend">
                {config.zones.map((zone) => (
                  <span className="warehouse-page__legend-item" key={zone.id}>
                    <span className={`warehouse-page__legend-dot warehouse-page__legend-dot--${zone.id.toLowerCase()}`} />
                    {zone.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        <aside className="warehouse-page__side">
          <Card>
            <CardHeader icon={<Icon name="box" size={16} />} title="Ubicación" />
            <div className="warehouse-page__selects">
              <Select
                label="Zona"
                value={selected.zone}
                onChange={(e) => setSelected({ zone: e.target.value, line: "", height: "", position: "" })}
                options={config.zones.map((z) => ({ value: z.id, label: z.name }))}
                placeholder="Seleccioná una zona"
              />
              <Select
                label="Línea"
                value={selected.line}
                onChange={(e) => setSelected((s) => ({ ...s, line: e.target.value }))}
                options={lineOptions}
                placeholder="Seleccioná una línea"
                disabled={!selectedZone}
              />
              <Select
                label="Altura"
                value={selected.height}
                onChange={(e) => setSelected((s) => ({ ...s, height: e.target.value }))}
                options={heightOptions}
                placeholder="Seleccioná una altura"
                disabled={!selectedZone}
              />
              <Select
                label="Posición"
                value={selected.position}
                onChange={(e) => setSelected((s) => ({ ...s, position: e.target.value }))}
                options={positionOptions}
                placeholder="Seleccioná una posición"
                disabled={!selectedZone}
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Icon name="info" size={16} />} title="Información de la ubicación" />
            <InfoList items={locationInfo} />
          </Card>

          <Card>
            <CardHeader icon={<Icon name="box" size={16} />} title="Detalles del producto" />
            <InfoList items={productInfo} />
          </Card>
        </aside>
      </div>

      <div className="warehouse-page__actions">
        <Button
          variant="secondary"
          iconLeft={<Icon name="grid" size={16} />}
          onClick={() => setEditing("zones")}
        >
          Modificar zonas
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Icon name="list" size={16} />}
          onClick={() => setEditing("lines")}
        >
          Modificar líneas
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Icon name="target" size={16} />}
          onClick={() => setEditing("positions")}
        >
          Modificar posiciones
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Icon name="file" size={16} />}
          onClick={() => setEditing("data")}
        >
          Modificar datos de ubicación
        </Button>
      </div>

      <Modal
        open={!!editing && editing !== "data"}
        onClose={() => setEditing(null)}
        title={
          editing === "zones"
            ? "Estructura de zonas"
            : editing === "lines"
              ? "Modificar líneas"
              : "Modificar posiciones"
        }
        size="lg"
      >
        {editing === "zones" && (
          <StructureEditForm
            zones={config.zones}
            fields={["lines", "positions", "heights"]}
            onSubmit={handleSaveStructure}
            onCancel={() => setEditing(null)}
          />
        )}
        {editing === "lines" && (
          <StructureEditForm
            zones={config.zones}
            fields={["lines"]}
            onSubmit={handleSaveStructure}
            onCancel={() => setEditing(null)}
          />
        )}
        {editing === "positions" && (
          <StructureEditForm
            zones={config.zones}
            fields={["positions", "heights"]}
            onSubmit={handleSaveStructure}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={editing === "data"}
        onClose={() => setEditing(null)}
        title="Modificar datos de ubicación"
      >
        <p className="warehouse-page__data-note">
          Esta función requiere endpoints del backend para asociar productos a ubicaciones.
          Seleccioná un producto desde Productos y editá sus campos de ubicación.
        </p>
        <div className="warehouse-page__data-actions">
          <Button onClick={() => setEditing(null)}>Entendido</Button>
        </div>
      </Modal>
    </div>
  );
}
