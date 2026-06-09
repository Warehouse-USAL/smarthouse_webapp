import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Select from "../../components/ui/Select/Select";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import Icon from "../../components/ui/Icon/Icon";
import Badge from "../../components/ui/Badge/Badge";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import ZonePickerGrid from "../../components/warehouse/ZonePickerGrid/ZonePickerGrid";
import { productService } from "../../services/productService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { stockPositionService } from "../../services/stockPositionService";
import {
  STORAGE_UNITS,
  STORAGE_UNIT_LABEL,
  UNIT_TO_SIZE,
  SIZE_TO_UNIT,
  POSITION_SIZE_LABEL,
} from "../../lib/storageCompatibility";
import "./StockAssignmentPage.css";

// Hito 2 §8 + §10 + §11 (revisado).
// El operador elige producto + tipo de unidad + cantidad y luego, sobre el
// MAPA del warehouse, elige manualmente las posiciones disponibles. Las
// posiciones se llenan en orden de clic: cada una recibe `unitsPerSlot`
// unidades y la última el resto, hasta cubrir la cantidad pedida.
// Solo son elegibles las posiciones compatibles (mismo tamaño que la unidad)
// y libres (sin producto asignado).

const STORAGE_UNIT_OPTIONS = STORAGE_UNITS.map((u) => ({
  value: u,
  label: STORAGE_UNIT_LABEL[u],
}));

const unitsPerSlotFor = (product, storageUnit) => {
  if (!product || !storageUnit) return 0;
  switch (storageUnit) {
    case "PALLET": return product.unitsPerPallet || 0;
    case "MEDIO_PALLET": return product.unitsPerHalfPallet || 0;
    case "CAJA": return product.unitsPerBox || 0;
    default: return 0;
  }
};

export default function StockAssignmentPage() {
  const [products, setProducts] = useState([]);
  const [tree, setTree] = useState({ zones: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [productId, setProductId] = useState("");
  const [storageUnit, setStorageUnit] = useState("");
  const [quantity, setQuantity] = useState("");

  // Posiciones elegidas en el mapa, en orden de clic. Cada item guarda el
  // detalle necesario para mostrar el resumen y persistir el StockPosicion.
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      productService.list({ isActive: true }),
      warehouseConfigService.get(),
    ])
      .then(([prods, t]) => {
        if (cancelled) return;
        setProducts(prods);
        setTree(t);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.sku} · ${p.name}`,
      })),
    [products]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  );

  // Solo unidades que tengan capacidad declarada en el producto.
  const availableStorageUnits = useMemo(() => {
    if (!selectedProduct) return [];
    return STORAGE_UNIT_OPTIONS.filter((opt) => unitsPerSlotFor(selectedProduct, opt.value) > 0);
  }, [selectedProduct]);

  const unitsPerSlot = unitsPerSlotFor(selectedProduct, storageUnit);
  const requiredSize = storageUnit ? UNIT_TO_SIZE[storageUnit] : null;
  const totalQuantity = Number(quantity) || 0;

  // Una posición es elegible si su tamaño mapea al storageUnit elegido y está
  // libre (sin producto asignado).
  const isSelectable = (position) =>
    SIZE_TO_UNIT[position.sizeStockToSave] === storageUnit && !position.assignedProduct;

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.idPosition)),
    [selected]
  );

  // Reparte la cantidad total sobre las posiciones elegidas en orden de clic:
  // cada una recibe unitsPerSlot, la última el resto. Devuelve el plan con la
  // cantidad asignada a cada posición y cuántas unidades quedan sin ubicar.
  const plan = useMemo(() => {
    if (!unitsPerSlot || totalQuantity <= 0) {
      return { slots: [], assigned: 0, remainder: totalQuantity };
    }
    let pending = totalQuantity;
    const slots = selected.map((pos) => {
      const put = Math.min(unitsPerSlot, pending);
      pending -= put;
      return { ...pos, quantity: put };
    });
    const assigned = totalQuantity - pending;
    return { slots, assigned, remainder: pending };
  }, [selected, unitsPerSlot, totalQuantity]);

  // Cuántas posiciones hacen falta para cubrir toda la cantidad.
  const slotsNeeded = unitsPerSlot > 0 ? Math.ceil(totalQuantity / unitsPerSlot) : 0;

  const resetSelection = () => {
    setSelected([]);
    setFeedback(null);
  };

  const handleProductChange = (e) => {
    setProductId(e.target.value);
    setStorageUnit("");
    setQuantity("");
    resetSelection();
  };

  const handleStorageUnitChange = (e) => {
    setStorageUnit(e.target.value);
    setQuantity("");
    resetSelection();
  };

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    resetSelection();
  };

  const handleTogglePosition = (pos) => {
    setFeedback(null);
    setSelected((prev) => {
      const exists = prev.some((s) => s.idPosition === pos.idPosition);
      if (exists) {
        return prev.filter((s) => s.idPosition !== pos.idPosition);
      }
      // No dejar elegir más posiciones de las necesarias.
      if (prev.length >= slotsNeeded) return prev;
      return [...prev, pos];
    });
  };

  const handleConfirm = async () => {
    if (plan.slots.length === 0 || plan.remainder > 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      // 1. Persistir StockPosicion para cada posición elegida.
      const entries = plan.slots.map((slot) => ({
        productId: selectedProduct.id,
        idPosition: slot.idPosition,
        storageUnit,
        quantity: slot.quantity,
      }));
      await stockPositionService.createMany(entries);

      // 2. Marcar las posiciones como ocupadas en el warehouse (mock).
      //    En producción esto lo deriva el backend desde StockPosicion.
      await Promise.all(
        plan.slots.map((slot) =>
          warehouseConfigService.assignProductToPosition(
            slot.idPosition,
            {
              id: selectedProduct.id,
              sku: selectedProduct.sku,
              name: selectedProduct.name,
            },
            slot.quantity
          )
        )
      );

      // 3. Sumar el stock asignado al availableStock del producto.
      const totalAssigned = plan.slots.reduce((sum, s) => sum + s.quantity, 0);
      await productService.update(selectedProduct.id, {
        availableStock: (selectedProduct.availableStock || 0) + totalAssigned,
      });

      // 4. Recargar datasets para reflejar el nuevo estado del mapa.
      const [nextProds, nextTree] = await Promise.all([
        productService.list({ isActive: true }),
        warehouseConfigService.get(),
      ]);
      setProducts(nextProds);
      setTree(nextTree);

      setFeedback({
        type: "success",
        message: `Asignadas ${totalAssigned} unidades en ${plan.slots.length} posiciones.`,
      });
      setQuantity("");
      setSelected([]);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.response?.data?.error?.message || "No pudimos asignar el stock.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="stock-assignment">
        <PageHeader title="Asignación de stock" />
        <Card>
          <Spinner label="Cargando…" />
        </Card>
      </div>
    );
  }

  const formReady = selectedProduct && storageUnit && totalQuantity > 0;

  return (
    <div className="stock-assignment">
      <PageHeader
        title="Asignación de stock"
        subtitle="Elegí producto, tipo de unidad y cantidad. Después seleccioná en el mapa las posiciones disponibles donde guardar el stock."
      />

      <Card padding="lg">
        <CardHeader icon={<Icon name="box" size={16} />} title="Datos de la asignación" />
        <div className="stock-assignment__form">
          <Select
            label="Producto"
            value={productId}
            onChange={handleProductChange}
            options={productOptions}
            placeholder="Seleccioná producto"
          />
          <Select
            label="Tipo de unidad de almacenamiento"
            value={storageUnit}
            onChange={handleStorageUnitChange}
            options={availableStorageUnits}
            placeholder={
              !selectedProduct
                ? "Seleccioná un producto primero"
                : availableStorageUnits.length === 0
                  ? "El producto no tiene capacidades definidas"
                  : "Seleccioná unidad"
            }
            disabled={!selectedProduct || availableStorageUnits.length === 0}
          />
          <Input
            name="quantity"
            label="Cantidad de unidades"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={handleQuantityChange}
            disabled={!storageUnit}
          />
        </div>

        {selectedProduct && storageUnit && (
          <div className="stock-assignment__meta">
            <span>
              Unidades por <strong>{STORAGE_UNIT_LABEL[storageUnit]}</strong>:{" "}
              <strong>{unitsPerSlot}</strong>
            </span>
            <span>
              Requiere posiciones de tamaño{" "}
              <strong>{POSITION_SIZE_LABEL[requiredSize]}</strong>
            </span>
            {totalQuantity > 0 && (
              <span>
                Posiciones necesarias: <strong>{slotsNeeded}</strong>
              </span>
            )}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader
          icon={<Icon name="map" size={16} />}
          title="Mapa del warehouse"
          action={
            formReady && selected.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={resetSelection}>
                Limpiar selección
              </Button>
            ) : null
          }
        />

        {!formReady ? (
          <EmptyState
            icon="info"
            title="Completá los datos de la asignación"
            description="Cuando elijas producto, unidad y cantidad, vas a poder seleccionar las posiciones en el mapa."
          />
        ) : (
          <>
            <p className="stock-assignment__map-hint">
              Seleccioná posiciones <strong>{POSITION_SIZE_LABEL[requiredSize]}</strong> libres
              (resaltadas). Se llenan en orden de selección hasta cubrir las{" "}
              <strong>{totalQuantity}</strong> unidades.
            </p>
            <div className="stock-assignment__map">
              {tree.zones.length === 0 ? (
                <EmptyState
                  icon="info"
                  title="No hay zonas configuradas"
                  description="Configurá el warehouse con posiciones del tamaño correspondiente antes de asignar stock."
                />
              ) : (
                tree.zones.map((zone) => (
                  <ZonePickerGrid
                    key={zone.idZone}
                    zone={zone}
                    selectedIds={selectedIds}
                    isSelectable={isSelectable}
                    onToggle={handleTogglePosition}
                  />
                ))
              )}
            </div>
          </>
        )}

        {formReady && plan.slots.length > 0 && (
          <>
            <ul className="stock-assignment__plan">
              {plan.slots.map((slot, idx) => (
                <li key={slot.idPosition} className="stock-assignment__plan-item">
                  <div className="stock-assignment__plan-pos">
                    <span className="stock-assignment__plan-index">{idx + 1}</span>
                    <Icon name="pin" size={14} />
                    <span>
                      {slot.zoneName} · Línea {String(slot.lineNumber).padStart(2, "0")} ·{" "}
                      {slot.positionName}
                    </span>
                  </div>
                  <div className="stock-assignment__plan-meta">
                    <Badge variant="success">Posición libre</Badge>
                    <span className="stock-assignment__plan-qty">{slot.quantity} u</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="stock-assignment__summary">
              <span>
                Asignado: <strong>{plan.assigned}</strong> de <strong>{totalQuantity}</strong>{" "}
                unidades en <strong>{plan.slots.length}</strong> posiciones
              </span>
              {plan.remainder > 0 && (
                <span className="stock-assignment__remainder">
                  Faltan <strong>{plan.remainder}</strong> u — seleccioná{" "}
                  {slotsNeeded - plan.slots.length} posición(es) más.
                </span>
              )}
            </div>
          </>
        )}

        {feedback && (
          <div className={`stock-assignment__feedback stock-assignment__feedback--${feedback.type}`}>
            <Icon name="info" size={14} /> {feedback.message}
          </div>
        )}

        <div className="stock-assignment__actions">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!formReady || plan.slots.length === 0 || plan.remainder > 0 || submitting}
          >
            {submitting ? "Asignando…" : "Confirmar asignación"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
