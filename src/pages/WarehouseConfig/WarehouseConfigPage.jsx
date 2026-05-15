import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Select from "../../components/ui/Select/Select";
import Icon from "../../components/ui/Icon/Icon";
import Spinner from "../../components/ui/Spinner/Spinner";
import ZoneGrid from "../../components/warehouse/ZoneGrid/ZoneGrid";
import InfoList from "../../components/warehouse/InfoList/InfoList";
import ZonesEditModal from "../../components/warehouse/ZonesEditModal/ZonesEditModal";
import LinesEditModal from "../../components/warehouse/LinesEditModal/LinesEditModal";
import PositionsEditModal from "../../components/warehouse/PositionsEditModal/PositionsEditModal";
import LocationDataEditModal from "../../components/warehouse/LocationDataEditModal/LocationDataEditModal";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { productService } from "../../services/productService";
import "./WarehouseConfigPage.css";

const buildOptions = (count, prefix) =>
  Array.from({ length: count || 0 }, (_, i) => ({
    value: String(i + 1),
    label: `${prefix} ${String(i + 1).padStart(2, "0")}`,
  }));

export default function WarehouseConfigPage() {
  const [config, setConfig] = useState(() => warehouseConfigService.get());
  const [selected, setSelected] = useState({ zone: "", line: "", position: "", height: "" });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(null);

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

  const zoneOptions = useMemo(
    () => config.zones.map((z) => ({ value: z.id, label: z.name })),
    [config]
  );

  const lineOptions = useMemo(
    () => buildOptions(selectedZone?.lines || 0, "Línea"),
    [selectedZone]
  );

  const lineConfig = useMemo(() => {
    if (!selectedZone || !selected.line) return null;
    const override = selectedZone.lineOverrides?.[String(selected.line)] || {};
    return { positions: override.positions ?? selectedZone.positions };
  }, [selectedZone, selected.line]);

  const positionOptions = useMemo(
    () => buildOptions(lineConfig?.positions || 0, "Posición"),
    [lineConfig]
  );

  const positionConfig = useMemo(() => {
    if (!selectedZone || !selected.line || !selected.position) return null;
    const key = `L${selected.line}-P${selected.position}`;
    const override = selectedZone.positionOverrides?.[key] || {};
    return { height: override.height ?? selectedZone.heights };
  }, [selectedZone, selected.line, selected.position]);

  const heightOptions = useMemo(
    () => buildOptions(positionConfig?.height || 0, "Altura"),
    [positionConfig]
  );

  const locationCode = warehouseConfigService.buildLocationCode(selected);

  const locationData = useMemo(() => {
    if (!selectedZone || !selected.line || !selected.position || !selected.height) return null;
    const key = `L${selected.line}-P${selected.position}-H${selected.height}`;
    return selectedZone.locationData?.[key] || null;
  }, [selectedZone, selected.line, selected.position, selected.height]);

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
      height: prev.zone === zone && prev.position === String(position) && prev.line === String(line) ? prev.height : "",
    }));
  };

  const handleModalSaved = (next) => {
    setConfig(next);
  };

  const handleSelectChange = (field) => (e) => {
    const value = e.target.value;
    setSelected((s) => {
      const next = { ...s, [field]: value };
      if (field === "zone") { next.line = ""; next.position = ""; next.height = ""; }
      if (field === "line") { next.position = ""; next.height = ""; }
      if (field === "position") { next.height = ""; }
      return next;
    });
  };

  const locationInfo = [
    { label: "Código de la ubicación", value: locationCode },
    { label: "Capacidad máxima", value: locationData?.capacity },
    { label: "Stock actual", value: matchingProduct?.availableStock },
  ];

  const productInfo = [
    { label: "Nombre", value: matchingProduct?.name },
    { label: "Código", value: matchingProduct?.sku },
    { label: "Stock actual", value: matchingProduct?.availableStock },
    { label: "Punto de reposición", value: matchingProduct?.reorderPoint },
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
                    <span
                      className={`warehouse-page__legend-dot warehouse-page__legend-dot--${(zone.color || zone.id).toLowerCase()}`}
                    />
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
            <div className="warehouse-page__location-selects">
              <Select
                label="Zona"
                value={selected.zone}
                onChange={handleSelectChange("zone")}
                options={zoneOptions}
                placeholder="Seleccioná una zona"
              />
              <Select
                label="Línea"
                value={selected.line}
                onChange={handleSelectChange("line")}
                options={lineOptions}
                placeholder="Seleccioná una línea"
                disabled={!selected.zone}
              />
              <Select
                label="Altura"
                value={selected.height}
                onChange={handleSelectChange("height")}
                options={heightOptions}
                placeholder="Seleccioná una altura"
                disabled={!selected.position}
              />
              <Select
                label="Posición"
                value={selected.position}
                onChange={handleSelectChange("position")}
                options={positionOptions}
                placeholder="Seleccioná una posición"
                disabled={!selected.line}
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

      <div className="warehouse-page__action-bar">
        <button type="button" className="warehouse-page__action" onClick={() => setOpenModal("zones")}>
          <span className="warehouse-page__action-icon"><Icon name="grid" size={20} /></span>
          <span>Modificar zonas</span>
        </button>
        <button type="button" className="warehouse-page__action" onClick={() => setOpenModal("lines")}>
          <span className="warehouse-page__action-icon"><Icon name="list" size={20} /></span>
          <span>Modificar líneas</span>
        </button>
        <button type="button" className="warehouse-page__action" onClick={() => setOpenModal("positions")}>
          <span className="warehouse-page__action-icon"><Icon name="target" size={20} /></span>
          <span>Modificar posiciones</span>
        </button>
        <button type="button" className="warehouse-page__action" onClick={() => setOpenModal("data")}>
          <span className="warehouse-page__action-icon"><Icon name="file" size={20} /></span>
          <span>Modificar datos de ubicación</span>
        </button>
      </div>

      <ZonesEditModal
        open={openModal === "zones"}
        onClose={() => setOpenModal(null)}
        onSaved={handleModalSaved}
      />
      <LinesEditModal
        open={openModal === "lines"}
        onClose={() => setOpenModal(null)}
        onSaved={handleModalSaved}
      />
      <PositionsEditModal
        open={openModal === "positions"}
        onClose={() => setOpenModal(null)}
        onSaved={handleModalSaved}
      />
      <LocationDataEditModal
        open={openModal === "data"}
        onClose={() => setOpenModal(null)}
        onSaved={handleModalSaved}
      />
    </div>
  );
}
