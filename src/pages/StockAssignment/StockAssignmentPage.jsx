import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Select from "../../components/ui/Select/Select";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import Icon from "../../components/ui/Icon/Icon";
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

// Hito 2 §8 (revisado). Ya no existen capacidades por unidad en el producto
// (unitsPerPallet/HalfPallet/Box) ni asignación automática.
//
// Flujo:
//   1. El operador elige producto + tipo de unidad (Pallet/Medio/Caja) + cantidad.
//      El tipo de unidad determina el tamaño de posición compatible.
//   2. Sobre el MAPA del warehouse selecciona las posiciones — solo las
//      compatibles (mismo tamaño) y libres son elegibles.
//   3. Por cada posición elegida ingresa libremente cuántas unidades del
//      producto guardar ahí (sin tope de capacidad, por ahora).
//   4. Confirma cuando lo asignado iguala la cantidad total.

const STORAGE_UNIT_OPTIONS = STORAGE_UNITS.map((u) => ({
  value: u,
  label: STORAGE_UNIT_LABEL[u],
}));

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
  // detalle de la posición + las unidades que el operador decidió poner ahí.
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

  // Reparte la cantidad total en partes iguales entre las posiciones elegidas;
  // el resto se suma a la última. Devuelve [{ ...pos, quantity }].
  const plan = useMemo(() => {
    if (selected.length === 0 || totalQuantity <= 0) return [];
    const base = Math.floor(totalQuantity / selected.length);
    const rest = totalQuantity - base * selected.length;
    return selected.map((pos, idx) => ({
      ...pos,
      quantity: base + (idx === selected.length - 1 ? rest : 0),
    }));
  }, [selected, totalQuantity]);

  // Primera posición cuyo reparto supera su capacidad máxima. El backend
  // rechazaría con 400 STOCK_EXCEEDS_CAPACITY; lo bloqueamos antes.
  const overCapacitySlot = useMemo(
    () =>
      plan.find(
        (slot) => slot.maximumCapacity > 0 && slot.quantity > slot.maximumCapacity
      ) || null,
    [plan]
  );

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

  // Toggle de una posición desde el mapa.
  const handleTogglePosition = (pos) => {
    setFeedback(null);
    setSelected((prev) => {
      const exists = prev.some((s) => s.idPosition === pos.idPosition);
      if (exists) return prev.filter((s) => s.idPosition !== pos.idPosition);
      return [...prev, pos];
    });
  };

  const canConfirm =
    selectedProduct && storageUnit && totalQuantity > 0 && selected.length > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (overCapacitySlot) {
      setFeedback({
        type: "error",
        message: `La posición ${overCapacitySlot.positionName} no admite ${overCapacitySlot.quantity} unidades (capacidad ${overCapacitySlot.maximumCapacity}).`,
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      // Asignar producto + cantidad a cada posición elegida. Esto hace un
      // PATCH /warehouse/positions/:id por posición (product_id + current_stock).
      // El stock disponible del producto lo computa el backend desde las
      // posiciones; no hay que actualizarlo a mano.
      const entries = plan.map((slot) => ({
        productId: selectedProduct.id,
        idPosition: slot.idPosition,
        storageUnit,
        quantity: slot.quantity,
      }));
      await stockPositionService.createMany(entries);

      // Recargar datasets para reflejar el nuevo estado del mapa y los stocks.
      const [nextProds, nextTree] = await Promise.all([
        productService.list({ isActive: true }),
        warehouseConfigService.get(),
      ]);
      setProducts(nextProds);
      setTree(nextTree);

      const totalAssigned = plan.reduce((sum, s) => sum + s.quantity, 0);
      setFeedback({
        type: "success",
        message: `Asignadas ${totalAssigned} unidades en ${plan.length} posiciones.`,
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
        subtitle="Elegí producto, tipo de unidad y cantidad. Después seleccioná en el mapa las posiciones disponibles e ingresá cuántas unidades poner en cada una."
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
            options={STORAGE_UNIT_OPTIONS}
            placeholder={
              !selectedProduct ? "Seleccioná un producto primero" : "Seleccioná unidad"
            }
            disabled={!selectedProduct}
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
              Unidad seleccionada: <strong>{STORAGE_UNIT_LABEL[storageUnit]}</strong>
            </span>
            <span>
              Requiere posiciones de tamaño{" "}
              <strong>{POSITION_SIZE_LABEL[requiredSize]}</strong>
            </span>
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
              (resaltadas). Para cada una vas a indicar cuántas unidades guardar, hasta cubrir las{" "}
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
            {tree.zones.length > 0 && (
              <div className="stock-assignment__legend">
                {tree.zones.map((zone) => (
                  <span className="stock-assignment__legend-item" key={zone.idZone}>
                    <span
                      className={`stock-assignment__legend-dot stock-assignment__legend-dot--${(zone.color || zone.zoneCode || "").toLowerCase()}`}
                    />
                    {zone.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {formReady && plan.length > 0 && (
          <>
            <ul className="stock-assignment__plan">
              {plan.map((slot, idx) => {
                const over = slot.maximumCapacity > 0 && slot.quantity > slot.maximumCapacity;
                return (
                  <li key={slot.idPosition} className="stock-assignment__plan-item">
                    <div className="stock-assignment__plan-pos">
                      <span className="stock-assignment__plan-index">{idx + 1}</span>
                      <Icon name="pin" size={14} />
                      <span>
                        {slot.zoneName} · Línea {String(slot.lineNumber).padStart(2, "0")} ·{" "}
                        {slot.positionName}
                      </span>
                    </div>
                    <span className="stock-assignment__plan-unit">
                      {slot.quantity} u
                      {slot.maximumCapacity > 0 && (
                        <small
                          className={over ? "stock-assignment__plan-cap--over" : undefined}
                        >
                          {" "}/ {slot.maximumCapacity}
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="stock-assignment__summary">
              <span>
                <strong>{totalQuantity}</strong> unidades repartidas en{" "}
                <strong>{plan.length}</strong> posiciones.
              </span>
            </div>

            {overCapacitySlot && (
              <div className="stock-assignment__feedback stock-assignment__feedback--error">
                <Icon name="info" size={14} /> La posición {overCapacitySlot.positionName}{" "}
                supera su capacidad ({overCapacitySlot.quantity} &gt;{" "}
                {overCapacitySlot.maximumCapacity}). Elegí más posiciones o reducí la cantidad.
              </div>
            )}
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
            disabled={!canConfirm || submitting || !!overCapacitySlot}
          >
            {submitting ? "Asignando…" : "Confirmar asignación"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
