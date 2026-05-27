/*
|--------------------------------------------------------------------------
| STOCK ALLOCATION
|--------------------------------------------------------------------------
|
| Algoritmo puro (Hito 2 §10, §11) que decide cómo distribuir `quantity`
| unidades de un producto en las posiciones del warehouse.
|
| Regla:
|   1. Primero completar posiciones PARCIALES compatibles que ya tengan
|      este mismo producto.
|   2. Luego usar posiciones LIBRES compatibles.
|   3. Si después del paso 2 todavía queda stock pendiente, se devuelve
|      como remainder (la pantalla decide qué hacer: error o sobrante).
|
| Entrada:
|   - product:        { id, unitsPerPallet, unitsPerHalfPallet, unitsPerBox }
|   - storageUnit:    PALLET | MEDIO_PALLET | CAJA
|   - quantity:       unidades totales a almacenar
|   - tree:           warehouseConfigService.get() — árbol de zonas
|   - stockPositions: lista de StockPosicion ya existentes (productId/positionId/storageUnit/quantity)
|
| Salida:
|   {
|     plan: [
|       { idPosition, zoneName, lineNumber, positionName, storageUnit, quantity, isPartial }
|     ],
|     remainder: number,    // unidades que no entraron
|     unitsPerSlot: number, // unidades que entran en una posición según storageUnit
|   }
|
| Notas:
| - "Unidad" del producto define cuántas unidades equivalen a UNA posición:
|     PALLET       → product.unitsPerPallet
|     MEDIO_PALLET → product.unitsPerHalfPallet
|     CAJA         → product.unitsPerBox
| - Cada posición almacena exactamente una unidad del tipo definido por su
|   sizeStockToSave — alineado con Hito 2 §4.3.2: "cada tipo de posición
|   podrá almacenar únicamente un tipo de unidad".
|
*/

import { SIZE_TO_UNIT } from "./storageCompatibility";

const unitsPerSlotFor = (product, storageUnit) => {
  switch (storageUnit) {
    case "PALLET": return product.unitsPerPallet || 0;
    case "MEDIO_PALLET": return product.unitsPerHalfPallet || 0;
    case "CAJA": return product.unitsPerBox || 0;
    default: return 0;
  }
};

/**
 * Lista todas las posiciones compatibles con un storageUnit del árbol.
 * Una posición es compatible si su sizeStockToSave mapea a ese storageUnit.
 * Toda posición existente se considera usable (no hay flag de activación).
 */
const listCompatiblePositions = (tree, storageUnit) => {
  const out = [];
  for (const zone of tree.zones || []) {
    for (const line of zone.lines || []) {
      for (const position of line.positions || []) {
        if (SIZE_TO_UNIT[position.sizeStockToSave] !== storageUnit) continue;
        out.push({
          idPosition: position.idPosition,
          zoneName: zone.name,
          lineNumber: line.numberLine,
          positionName: position.positionName,
        });
      }
    }
  }
  return out;
};

/**
 * Construye un mapa idPosition → cantidad ya almacenada del producto en esa
 * posición (sumando todos los StockPosicion existentes).
 */
const buildPartialIndex = (stockPositions, productId, storageUnit) => {
  const map = new Map();
  for (const sp of stockPositions || []) {
    if (sp.productId !== productId) continue;
    if (sp.storageUnit !== storageUnit) continue;
    map.set(sp.idPosition, (map.get(sp.idPosition) || 0) + sp.quantity);
  }
  return map;
};

export const planAllocation = ({
  product,
  storageUnit,
  quantity,
  tree,
  stockPositions,
}) => {
  const unitsPerSlot = unitsPerSlotFor(product, storageUnit);
  if (unitsPerSlot <= 0 || quantity <= 0) {
    return { plan: [], remainder: quantity, unitsPerSlot };
  }

  const compatible = listCompatiblePositions(tree, storageUnit);
  const partial = buildPartialIndex(stockPositions, product.id, storageUnit);

  // Posiciones ocupadas por OTROS productos quedan fuera. Una posición está
  // ocupada por otro si tiene assignedProduct distinto a este producto.
  const isUsableForThisProduct = (idPosition) => {
    for (const zone of tree.zones) {
      for (const line of zone.lines) {
        const p = line.positions.find((x) => x.idPosition === idPosition);
        if (!p) continue;
        if (!p.assignedProduct) return true;
        return p.assignedProduct.id === product.id;
      }
    }
    return false;
  };

  // Paso 1: completar parciales (de este mismo producto).
  const plan = [];
  let pending = quantity;

  const partials = compatible
    .filter((c) => partial.has(c.idPosition))
    .map((c) => ({ ...c, current: partial.get(c.idPosition) }))
    .filter((c) => c.current < unitsPerSlot && isUsableForThisProduct(c.idPosition));

  for (const slot of partials) {
    if (pending <= 0) break;
    const free = unitsPerSlot - slot.current;
    const put = Math.min(free, pending);
    plan.push({
      idPosition: slot.idPosition,
      zoneName: slot.zoneName,
      lineNumber: slot.lineNumber,
      positionName: slot.positionName,
      storageUnit,
      quantity: put,
      isPartial: true,
    });
    pending -= put;
  }

  // Paso 2: posiciones libres compatibles (sin producto asignado).
  const libres = compatible.filter(
    (c) => !partial.has(c.idPosition) && isUsableForThisProduct(c.idPosition)
  );

  for (const slot of libres) {
    if (pending <= 0) break;
    const put = Math.min(unitsPerSlot, pending);
    plan.push({
      idPosition: slot.idPosition,
      zoneName: slot.zoneName,
      lineNumber: slot.lineNumber,
      positionName: slot.positionName,
      storageUnit,
      quantity: put,
      isPartial: false,
    });
    pending -= put;
  }

  return { plan, remainder: pending, unitsPerSlot };
};
