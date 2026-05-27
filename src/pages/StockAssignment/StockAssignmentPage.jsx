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
import { productService } from "../../services/productService";
import { warehouseConfigService } from "../../services/warehouseConfigService";
import { stockPositionService } from "../../services/stockPositionService";
import {
  STORAGE_UNITS,
  STORAGE_UNIT_LABEL,
  UNIT_TO_SIZE,
  POSITION_SIZE_LABEL,
} from "../../lib/storageCompatibility";
import { planAllocation } from "../../lib/stockAllocation";
import "./StockAssignmentPage.css";

// Hito 2 §8 + §10 + §11.
// Pantalla aislada para asignar stock físico a posiciones del warehouse.
// El operador elige producto + tipo de unidad + cantidad, el algoritmo
// planAllocation propone la distribución (parciales primero, luego libres)
// y al confirmar se persisten StockPosicion + se actualiza availableStock.

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
  const [stockPositions, setStockPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [productId, setProductId] = useState("");
  const [storageUnit, setStorageUnit] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      productService.list({ isActive: true }),
      warehouseConfigService.get(),
      stockPositionService.list(),
    ])
      .then(([prods, t, sps]) => {
        if (cancelled) return;
        setProducts(prods);
        setTree(t);
        setStockPositions(sps);
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

  const allocation = useMemo(() => {
    if (!selectedProduct || !storageUnit || !quantity) {
      return { plan: [], remainder: 0, unitsPerSlot: 0 };
    }
    return planAllocation({
      product: selectedProduct,
      storageUnit,
      quantity: Number(quantity) || 0,
      tree,
      stockPositions,
    });
  }, [selectedProduct, storageUnit, quantity, tree, stockPositions]);

  const handleProductChange = (e) => {
    setProductId(e.target.value);
    setStorageUnit("");
    setQuantity("");
    setFeedback(null);
  };

  const handleStorageUnitChange = (e) => {
    setStorageUnit(e.target.value);
    setQuantity("");
    setFeedback(null);
  };

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    setFeedback(null);
  };

  const handleConfirm = async () => {
    if (allocation.plan.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      // 1. Persistir StockPosicion para cada slot del plan.
      const entries = allocation.plan.map((slot) => ({
        productId: selectedProduct.id,
        idPosition: slot.idPosition,
        storageUnit: slot.storageUnit,
        quantity: slot.quantity,
      }));
      await stockPositionService.createMany(entries);

      // 2. Marcar las posiciones como ocupadas en el warehouse (mock).
      //    En producción esto lo deriva el backend desde StockPosicion.
      await Promise.all(
        allocation.plan.map((slot) =>
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
      const totalAssigned = allocation.plan.reduce((sum, s) => sum + s.quantity, 0);
      await productService.update(selectedProduct.id, {
        availableStock: (selectedProduct.availableStock || 0) + totalAssigned,
      });

      // 4. Recargar datasets para reflejar el nuevo estado.
      const [nextProds, nextTree, nextSps] = await Promise.all([
        productService.list({ isActive: true }),
        warehouseConfigService.get(),
        stockPositionService.list(),
      ]);
      setProducts(nextProds);
      setTree(nextTree);
      setStockPositions(nextSps);

      setFeedback({
        type: "success",
        message:
          allocation.remainder > 0
            ? `Asignadas ${totalAssigned} unidades. Quedaron ${allocation.remainder} sin ubicar por falta de posiciones compatibles.`
            : `Asignadas ${totalAssigned} unidades en ${allocation.plan.length} posiciones.`,
      });
      setQuantity("");
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

  const requiredSize = storageUnit ? UNIT_TO_SIZE[storageUnit] : null;
  const unitsPerSlot = unitsPerSlotFor(selectedProduct, storageUnit);
  const totalPlanned = allocation.plan.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="stock-assignment">
      <PageHeader
        title="Asignación de stock"
        subtitle="Ingresá producto, tipo de unidad y cantidad. El sistema completa primero posiciones parciales y después usa las libres."
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
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader icon={<Icon name="list" size={16} />} title="Plan de asignación" />

        {allocation.plan.length === 0 ? (
          <EmptyState
            icon="info"
            title={
              !selectedProduct || !storageUnit || !quantity
                ? "Completá los campos"
                : "No hay posiciones compatibles disponibles"
            }
            description={
              !selectedProduct || !storageUnit || !quantity
                ? "Cuando elijas producto, unidad y cantidad, vas a ver acá la distribución sugerida."
                : "Asegurate de tener zonas configuradas con el tamaño correspondiente y posiciones activas."
            }
          />
        ) : (
          <>
            <ul className="stock-assignment__plan">
              {allocation.plan.map((slot, idx) => (
                <li key={`${slot.idPosition}-${idx}`} className="stock-assignment__plan-item">
                  <div className="stock-assignment__plan-pos">
                    <Icon name="pin" size={14} />
                    <span>
                      {slot.zoneName} · Línea {String(slot.lineNumber).padStart(2, "0")} ·{" "}
                      {slot.positionName}
                    </span>
                  </div>
                  <div className="stock-assignment__plan-meta">
                    {slot.isPartial ? (
                      <Badge variant="warning">Completa parcial</Badge>
                    ) : (
                      <Badge variant="success">Posición libre</Badge>
                    )}
                    <span className="stock-assignment__plan-qty">
                      {slot.quantity} u
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="stock-assignment__summary">
              <span>
                Total a asignar: <strong>{totalPlanned}</strong> unidades en{" "}
                <strong>{allocation.plan.length}</strong> posiciones
              </span>
              {allocation.remainder > 0 && (
                <span className="stock-assignment__remainder">
                  Sin ubicar: <strong>{allocation.remainder}</strong> u — agregá zonas
                  compatibles o activá más posiciones.
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
            disabled={allocation.plan.length === 0 || submitting}
          >
            {submitting ? "Asignando…" : "Confirmar asignación"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
