/*
|--------------------------------------------------------------------------
| WAREHOUSE STATS
|--------------------------------------------------------------------------
|
| Métricas derivadas del árbol de configuración (el mismo que devuelve
| warehouseConfigService.get()). Todo se computa en el front a partir de lo
| que ya está cargado: no hay llamadas extra al backend.
|
| Una posición se considera "ocupada" si tiene assignedProduct. El árbol del
| listado solo trae product_id (assignedProduct parcial), suficiente para
| contar ocupación sin pedir el detalle de cada posición.
|
*/

import { POSITION_SIZES } from "./storageCompatibility";

const emptySizeMix = () =>
  POSITION_SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {});

const rate = (part, total) => (total > 0 ? part / total : 0);

// Resumen de una sola zona: cantidad de líneas, posiciones, ocupadas y mix de
// tamaños. Se usa tanto en el header de cada zona del mapa como agregado global.
export const computeZoneStats = (zone) => {
  const positions = (zone.lines || []).flatMap((line) => line.positions || []);
  const occupied = positions.filter((p) => p.assignedProduct).length;
  const sizeMix = emptySizeMix();
  for (const p of positions) {
    if (p.sizeStockToSave in sizeMix) sizeMix[p.sizeStockToSave] += 1;
  }
  return {
    lines: (zone.lines || []).length,
    positions: positions.length,
    occupied,
    empty: positions.length - occupied,
    occupancyRate: rate(occupied, positions.length),
    sizeMix,
  };
};

// Resumen global del warehouse + el desglose por zona (para no recorrer dos veces).
export const computeWarehouseStats = (config) => {
  const zones = config?.zones || [];
  const perZone = zones.map((zone) => ({ idZone: zone.idZone, ...computeZoneStats(zone) }));

  const totals = perZone.reduce(
    (acc, z) => {
      acc.lines += z.lines;
      acc.positions += z.positions;
      acc.occupied += z.occupied;
      for (const size of POSITION_SIZES) acc.sizeMix[size] += z.sizeMix[size];
      return acc;
    },
    { lines: 0, positions: 0, occupied: 0, sizeMix: emptySizeMix() }
  );

  return {
    zones: zones.length,
    lines: totals.lines,
    positions: totals.positions,
    occupied: totals.occupied,
    empty: totals.positions - totals.occupied,
    occupancyRate: rate(totals.occupied, totals.positions),
    sizeMix: totals.sizeMix,
    perZone,
  };
};
