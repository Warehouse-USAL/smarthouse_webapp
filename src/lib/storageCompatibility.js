/*
|--------------------------------------------------------------------------
| STORAGE COMPATIBILITY
|--------------------------------------------------------------------------
|
| Regla del Hito 2 (§4.3.2): cada tamaño de posición acepta únicamente un
| tipo de unidad de almacenamiento. El tamaño se define por posición
| (position.sizeStockToSave); la compatibilidad se valida entre el
| storageUnit del producto y el sizeStockToSave de la posición destino.
|
*/

export const POSITION_SIZES = ["PEQUEÑA", "MEDIANA", "GRANDE"];
export const STORAGE_UNITS = ["CAJA", "MEDIO_PALLET", "PALLET"];

export const SIZE_TO_UNIT = {
  PEQUEÑA: "CAJA",
  MEDIANA: "MEDIO_PALLET",
  GRANDE: "PALLET",
};

export const UNIT_TO_SIZE = {
  CAJA: "PEQUEÑA",
  MEDIO_PALLET: "MEDIANA",
  PALLET: "GRANDE",
};

export const STORAGE_UNIT_LABEL = {
  CAJA: "Caja",
  MEDIO_PALLET: "Medio Pallet",
  PALLET: "Pallet",
};

export const POSITION_SIZE_LABEL = {
  PEQUEÑA: "Pequeña",
  MEDIANA: "Mediana",
  GRANDE: "Grande",
};

export const isCompatible = (positionSize, storageUnit) =>
  SIZE_TO_UNIT[positionSize] === storageUnit;

// Volumen útil de cada unidad de almacenamiento, en cm³. Espejo EXACTO del enum
// StockSize del backend (CAJA/MEDIO_PALLET/PALLET → volumeCm3). El backend
// rechaza una asignación cuando product.volume * stock supera este volumen
// (PositionService: StockExceedsCapacityException). Mantener sincronizado.
export const STORAGE_VOLUME_CM3 = {
  CAJA: 48000,
  MEDIO_PALLET: 900000,
  PALLET: 1800000,
};

// Cuántas unidades de un producto entran en UNA posición de la unidad dada,
// según el volumen. Misma fórmula que el backend: floor(volumenTamaño /
// volumenProducto). Si el producto no tiene volumen (0/null), el backend no
// aplica el tope de volumen → devolvemos Infinity (sin límite por volumen).
export const unitsPerPosition = (productVolume, storageUnit) => {
  const size = STORAGE_VOLUME_CM3[storageUnit];
  const volume = Number(productVolume) || 0;
  if (!size || volume <= 0) return Infinity;
  return Math.floor(size / volume);
};
