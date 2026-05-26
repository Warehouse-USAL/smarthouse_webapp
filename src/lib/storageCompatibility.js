/*
|--------------------------------------------------------------------------
| STORAGE COMPATIBILITY
|--------------------------------------------------------------------------
|
| Regla del Hito 2 (§4.3.2): cada tamaño de posición acepta únicamente un
| tipo de unidad de almacenamiento. El tamaño se define a nivel de zona
| (zone.sizeStockToSave), por lo que la compatibilidad se valida entre el
| storageUnit del producto y el sizeStockToSave de la zona destino.
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

export const isCompatible = (zoneSize, storageUnit) =>
  SIZE_TO_UNIT[zoneSize] === storageUnit;
