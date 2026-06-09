import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Select from "../../components/ui/Select/Select";
import Icon from "../../components/ui/Icon/Icon";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import ZoneGrid from "../../components/warehouse/ZoneGrid/ZoneGrid";
import InfoList from "../../components/warehouse/InfoList/InfoList";
import ZonesEditModal from "../../components/warehouse/ZonesEditModal/ZonesEditModal";
import LinesEditModal from "../../components/warehouse/LinesEditModal/LinesEditModal";
import PositionsEditModal from "../../components/warehouse/PositionsEditModal/PositionsEditModal";
import LocationDataEditModal from "../../components/warehouse/LocationDataEditModal/LocationDataEditModal";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { stockPositionService } from "../../services/stockPositionService";
import { productService } from "../../services/productService";
import "./WarehouseConfigPage.css";

const EMPTY_SELECTION = { idZone: "", idLine: "", idPosition: "" };

const SIZE_LABEL = { PEQUEÑA: "Pequeña", MEDIANA: "Mediana", GRANDE: "Grande" };

export default function WarehouseConfigPage() {
  const [config, setConfig] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(EMPTY_SELECTION);
  const [positionDetail, setPositionDetail] = useState(null);
  const [openModal, setOpenModal] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    warehouseConfigService
      .get()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Detalle de la posición seleccionada (incluye assignedProduct, que el
  // listado del árbol no trae). On-demand para evitar N+1 al cargar la página.
  useEffect(() => {
    let cancelled = false;
    const promise = selected.idPosition
      ? warehouseConfigService.getPosition(selected.idPosition)
      : Promise.resolve(null);
    promise.then((detail) => {
      if (!cancelled) setPositionDetail(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [selected.idPosition]);

  const selectedZone = useMemo(
    () => warehouseConfigService.findZone(config, selected.idZone),
    [config, selected.idZone]
  );

  const selectedLine = useMemo(
    () => warehouseConfigService.findLine(selectedZone, selected.idLine),
    [selectedZone, selected.idLine]
  );

  const selectedPosition = useMemo(
    () => warehouseConfigService.findPosition(selectedLine, selected.idPosition),
    [selectedLine, selected.idPosition]
  );

  const zoneOptions = useMemo(
    () => config.zones.map((z) => ({ value: z.idZone, label: z.name })),
    [config]
  );

  const lineOptions = useMemo(
    () =>
      (selectedZone?.lines || []).map((l) => ({
        value: l.idLine,
        label: `Línea ${String(l.numberLine).padStart(2, "0")}`,
      })),
    [selectedZone]
  );

  const positionOptions = useMemo(
    () =>
      (selectedLine?.positions || []).map((p) => ({
        value: p.idPosition,
        label: p.positionName,
      })),
    [selectedLine]
  );

  const locationCode = warehouseConfigService.buildLocationCode({
    zoneCode: selectedZone?.zoneCode,
    numberLine: selectedLine?.numberLine,
    positionName: selectedPosition?.positionName,
  });

  const handleSelectFromMap = ({ idZone, idLine, idPosition }) => {
    setSelected({ idZone, idLine, idPosition });
    // Click en una ubicación del mapa abre directamente el modal de modificar
    // posición ya cargado con esa posición.
    setOpenModal("positions");
  };

  const handleSelectChange = (field) => (e) => {
    const value = e.target.value;
    setSelected((s) => {
      const next = { ...s, [field]: value };
      if (field === "idZone") { next.idLine = ""; next.idPosition = ""; }
      if (field === "idLine") { next.idPosition = ""; }
      return next;
    });
  };

  const handleModalSaved = (next) => {
    setConfig(next);
  };

  // Vacía una posición: borra las entradas de stockPositions, desasigna el
  // producto y descuenta del availableStock del producto. Mantiene la
  // simetría con el flujo de asignación de StockAssignmentPage.
  const handleClearProduct = async () => {
    if (!selected.idPosition || !assignedProduct) return;
    setClearing(true);
    try {
      const removedUnits = await stockPositionService.removeByPosition(selected.idPosition);
      await warehouseConfigService.clearProductFromPosition(selected.idPosition);
      if (removedUnits > 0 && assignedProduct.id) {
        const product = await productService.get(assignedProduct.id);
        const current = product?.availableStock ?? 0;
        await productService.update(assignedProduct.id, {
          availableStock: Math.max(0, current - removedUnits),
        });
      }
      const [nextConfig, nextDetail] = await Promise.all([
        warehouseConfigService.get(),
        warehouseConfigService.getPosition(selected.idPosition),
      ]);
      setConfig(nextConfig);
      setPositionDetail(nextDetail);
      setClearOpen(false);
    } catch (err) {
      alert(err.response?.data?.error?.message || "No pudimos quitar el producto.");
    } finally {
      setClearing(false);
    }
  };

  // Para los campos que pueden venir del detalle más fresco, preferimos el
  // detalle; si no, caemos al árbol.
  const positionView = positionDetail ?? selectedPosition;
  const assignedProduct = positionView?.assignedProduct ?? null;

  const locationInfo = [
    { label: "Código de la ubicación", value: locationCode },
    { label: "Tamaño", value: positionView ? SIZE_LABEL[positionView.sizeStockToSave] || positionView.sizeStockToSave : null },
  ];

  const productInfo = [
    { label: "Nombre", value: assignedProduct?.name },
    { label: "SKU", value: assignedProduct?.sku },
    {
      label: "Unidades en posición",
      value: assignedProduct ? `${positionView?.currentStock ?? 0}` : null,
    },
  ];

  return (
    <div className="warehouse-page">
      <PageHeader
        title="Configuración del warehouse"
        subtitle="Visualizá el mapa de zonas y definí la estructura física del warehouse."
      />

      {loading && (
        <div className="warehouse-page__loading">Cargando configuración…</div>
      )}

      <div className="warehouse-page__layout">
        <Card padding="lg" className="warehouse-page__map">
          <CardHeader icon={<Icon name="map" size={16} />} title="Mapa del warehouse" />
          <div className="warehouse-page__grids">
            {config.zones.map((zone) => (
              <ZoneGrid
                key={zone.idZone}
                zone={zone}
                selected={selected}
                onSelect={handleSelectFromMap}
              />
            ))}
          </div>
          <div className="warehouse-page__legend">
            {config.zones.map((zone) => (
              <span className="warehouse-page__legend-item" key={zone.idZone}>
                <span
                  className={`warehouse-page__legend-dot warehouse-page__legend-dot--${(zone.color || zone.zoneCode || "").toLowerCase()}`}
                />
                {zone.name}
              </span>
            ))}
          </div>
        </Card>

        <aside className="warehouse-page__side">
          <Card>
            <CardHeader icon={<Icon name="box" size={16} />} title="Ubicación" />
            <div className="warehouse-page__location-selects">
              <Select
                label="Zona"
                value={selected.idZone}
                onChange={handleSelectChange("idZone")}
                options={zoneOptions}
                placeholder="Seleccioná una zona"
              />
              <Select
                label="Línea"
                value={selected.idLine}
                onChange={handleSelectChange("idLine")}
                options={lineOptions}
                placeholder="Seleccioná una línea"
                disabled={!selected.idZone}
              />
              <Select
                label="Posición"
                value={selected.idPosition}
                onChange={handleSelectChange("idPosition")}
                options={positionOptions}
                placeholder="Seleccioná una posición"
                disabled={!selected.idLine}
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Icon name="info" size={16} />} title="Información de la ubicación" />
            <InfoList items={locationInfo} />
          </Card>

          <Card>
            <CardHeader icon={<Icon name="box" size={16} />} title="Producto asignado" />
            <InfoList items={productInfo} />
            {assignedProduct && (
              <div className="warehouse-page__assigned-actions">
                <Button
                  variant="danger"
                  iconLeft={<Icon name="trash" size={14} />}
                  onClick={() => setClearOpen(true)}
                >
                  Quitar producto
                </Button>
              </div>
            )}
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
          <span>Ver datos de ubicación</span>
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
        initialSelection={selected.idPosition ? selected : null}
      />
      <LocationDataEditModal
        open={openModal === "data"}
        onClose={() => setOpenModal(null)}
      />

      <Modal
        open={clearOpen}
        onClose={() => !clearing && setClearOpen(false)}
        title="Quitar producto de la posición"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearOpen(false)} disabled={clearing}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleClearProduct} disabled={clearing}>
              {clearing ? "Quitando…" : "Quitar"}
            </Button>
          </>
        }
      >
        {assignedProduct && (
          <p className="warehouse-page__clear-text">
            Se van a liberar <strong>{positionView?.currentStock ?? 0}</strong> unidades de{" "}
            <strong>{assignedProduct.name}</strong> (SKU: {assignedProduct.sku}) en{" "}
            <strong>{locationCode}</strong>. El stock disponible del producto se va a descontar
            en la misma cantidad.
          </p>
        )}
      </Modal>
    </div>
  );
}
