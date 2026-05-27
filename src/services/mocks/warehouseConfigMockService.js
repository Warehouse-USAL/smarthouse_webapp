/*
|--------------------------------------------------------------------------
| WAREHOUSE CONFIG MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste la configuración del warehouse en localStorage. Imita el shape
| normalizado (camelCase) que devuelve warehouseConfigService.
|
| Todos los métodos son async para que el shape coincida con el service
| real (backend).
|
| Shape (alineado con warehouseConfigService):
|   {
|     zones: [{
|       idZone, zoneCode, name, color, maxAllowedLines,
|       lines: [{
|         idLine, numberLine, maxAllowedPositions,
|         positions: [{
|           idPosition, positionName, sizeStockToSave,
|           assignedProduct   // { id, sku, name } | null
|         }]
|       }]
|     }]
|   }
|
| Nota: el tamaño se define por posición (position.sizeStockToSave).
| No hay flag isActive: toda zona/línea/posición existente se considera usable.
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "warehouse_config";
const STOCK_POSITIONS_KEY = "mock_stock_positions";

// Suma de unidades almacenadas en una posición (fuente de verdad:
// stockPositionMockService). Se calcula al vuelo para no duplicar estado.
const stockForPosition = (idPosition) => {
  if (!idPosition) return 0;
  const all = localStore.get(STOCK_POSITIONS_KEY, []);
  if (!Array.isArray(all)) return 0;
  return all
    .filter((sp) => sp.idPosition === idPosition)
    .reduce((sum, sp) => sum + (Number(sp.quantity) || 0), 0);
};

const withDerivedStock = (position) =>
  position ? { ...position, currentStock: stockForPosition(position.idPosition) } : position;

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const COLOR_PALETTE = ["a", "b", "c", "d"];

const colorForZone = (idZone) => {
  const key = String(idZone ?? "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
};

const buildPosition = ({ positionIndex, sizeStockToSave = "MEDIANA" }) => ({
  idPosition: uid("pos"),
  positionName: `P${String(positionIndex).padStart(2, "0")}`,
  sizeStockToSave,
  assignedProduct: null,
  // currentStock no se persiste: se deriva de stockPositions al leer.
});

const buildLine = ({ numberLine, maxAllowedPositions, sizeStockToSave }) => ({
  idLine: uid("line"),
  numberLine,
  maxAllowedPositions,
  positions: Array.from({ length: maxAllowedPositions }, (_, i) =>
    buildPosition({ positionIndex: i + 1, sizeStockToSave })
  ),
});

// defaultPositionSize: tamaño con el que se siembran las posiciones recién creadas.
// Es solo un valor inicial — cada posición se puede cambiar después de forma
// independiente desde PositionsEditModal.
const buildZone = ({ zoneCode, maxAllowedLines, defaultPositionSize, maxPositionsPerLine }) => {
  const idZone = uid("zone");
  return {
    idZone,
    zoneCode,
    name: `Zona ${zoneCode}`,
    color: colorForZone(idZone),
    maxAllowedLines,
    lines: Array.from({ length: maxAllowedLines }, (_, i) =>
      buildLine({
        numberLine: i + 1,
        maxAllowedPositions: maxPositionsPerLine,
        sizeStockToSave: defaultPositionSize,
      })
    ),
  };
};

const buildDefaultConfig = () => ({
  zones: [
    buildZone({ zoneCode: "A", maxAllowedLines: 4, defaultPositionSize: "PEQUEÑA", maxPositionsPerLine: 12 }),
    buildZone({ zoneCode: "B", maxAllowedLines: 4, defaultPositionSize: "MEDIANA", maxPositionsPerLine: 18 }),
    buildZone({ zoneCode: "C", maxAllowedLines: 4, defaultPositionSize: "MEDIANA", maxPositionsPerLine: 18 }),
    buildZone({ zoneCode: "D", maxAllowedLines: 4, defaultPositionSize: "GRANDE", maxPositionsPerLine: 18 }),
  ],
});

const isLegacyShape = (raw) => {
  if (!raw || !Array.isArray(raw.zones)) return true;
  const sample = raw.zones[0];
  if (!sample) return false;
  if ("heights" in sample) return true;
  if ("lineOverrides" in sample) return true;
  if ("positionOverrides" in sample) return true;
  if ("locationData" in sample) return true;
  if (!Array.isArray(sample.lines)) return true;
  // sizeStockToSave dejó de vivir en la zona y pasó a la posición.
  if ("sizeStockToSave" in sample) return true;
  // isActive (en zona, línea o posición) ya no existe.
  if ("isActive" in sample) return true;
  const sampleLine = sample.lines?.[0];
  if (sampleLine && "isActive" in sampleLine) return true;
  const samplePosition = sampleLine?.positions?.[0];
  if (samplePosition && "maximumCapacity" in samplePosition) return true;
  if (samplePosition && "isActive" in samplePosition) return true;
  if (samplePosition && !("sizeStockToSave" in samplePosition)) return true;
  return false;
};

const readConfig = () => {
  const raw = localStore.get(KEY, null);
  if (!raw || isLegacyShape(raw)) {
    const fresh = buildDefaultConfig();
    localStore.set(KEY, fresh);
    return fresh;
  }
  return raw;
};

const writeConfig = (config) => {
  localStore.set(KEY, config);
  return config;
};

const nextZoneCode = (zones) => {
  const used = new Set(zones.map((z) => z.zoneCode));
  for (let code = 65; code <= 90; code += 1) {
    const ch = String.fromCharCode(code);
    if (!used.has(ch)) return ch;
  }
  return `Z${zones.length + 1}`;
};

const mapZone = (zones, idZone, mapper) =>
  zones.map((z) => (z.idZone === idZone ? mapper(z) : z));

const mapLine = (zone, idLine, mapper) => ({
  ...zone,
  lines: zone.lines.map((l) => (l.idLine === idLine ? mapper(l) : l)),
});

const mapPosition = (line, idPosition, mapper) => ({
  ...line,
  positions: line.positions.map((p) => (p.idPosition === idPosition ? mapper(p) : p)),
});

const resizePositions = (positions, nextCount) => {
  if (nextCount === positions.length) return positions;
  if (nextCount < positions.length) return positions.slice(0, nextCount);
  // Las posiciones nuevas heredan el tamaño de la última existente para que
  // las líneas que ya estaban en un tamaño no pierdan el sesgo al crecer.
  const inheritedSize = positions[positions.length - 1]?.sizeStockToSave;
  const extra = Array.from({ length: nextCount - positions.length }, (_, i) =>
    buildPosition({
      positionIndex: positions.length + i + 1,
      sizeStockToSave: inheritedSize,
    })
  );
  return [...positions, ...extra];
};

export const warehouseConfigMockService = {
  async get() {
    await delay();
    const config = readConfig();
    return {
      ...config,
      zones: config.zones.map((z) => ({
        ...z,
        lines: z.lines.map((l) => ({
          ...l,
          positions: l.positions.map(withDerivedStock),
        })),
      })),
    };
  },

  /* ---------- Zonas ---------- */

  async addZone({ defaultPositionSize } = {}) {
    await delay();
    const config = readConfig();
    const zoneCode = nextZoneCode(config.zones);
    const zone = buildZone({
      zoneCode,
      maxAllowedLines: 4,
      defaultPositionSize: defaultPositionSize || "MEDIANA",
      maxPositionsPerLine: 12,
    });
    return writeConfig({ ...config, zones: [...config.zones, zone] });
  },

  async updateZone(idZone, patch) {
    await delay();
    const config = readConfig();
    const zones = mapZone(config.zones, idZone, (z) => ({ ...z, ...patch }));
    return writeConfig({ ...config, zones });
  },

  async removeZone(idZone) {
    await delay();
    const config = readConfig();
    return writeConfig({ ...config, zones: config.zones.filter((z) => z.idZone !== idZone) });
  },

  /* ---------- Líneas ---------- */

  async addLine(idZone, { maxAllowedPositions = 12 } = {}) {
    await delay();
    const config = readConfig();
    const zones = mapZone(config.zones, idZone, (z) => {
      const numberLine = (z.lines[z.lines.length - 1]?.numberLine ?? 0) + 1;
      const line = buildLine({ numberLine, maxAllowedPositions });
      return { ...z, lines: [...z.lines, line] };
    });
    return writeConfig({ ...config, zones });
  },

  async updateLine(idZone, idLine, patch) {
    await delay();
    const config = readConfig();
    const zones = mapZone(config.zones, idZone, (z) =>
      mapLine(z, idLine, (l) => {
        const next = { ...l, ...patch };
        if (
          patch.maxAllowedPositions != null &&
          patch.maxAllowedPositions !== l.maxAllowedPositions
        ) {
          next.positions = resizePositions(l.positions, patch.maxAllowedPositions);
        }
        return next;
      })
    );
    return writeConfig({ ...config, zones });
  },

  async removeLine(idZone, idLine) {
    await delay();
    const config = readConfig();
    const zones = mapZone(config.zones, idZone, (z) => ({
      ...z,
      lines: z.lines.filter((l) => l.idLine !== idLine),
    }));
    return writeConfig({ ...config, zones });
  },

  /* ---------- Posiciones ---------- */

  async updatePosition(idZone, idLine, idPosition, patch) {
    await delay();
    const config = readConfig();
    const zones = mapZone(config.zones, idZone, (z) =>
      mapLine(z, idLine, (l) => mapPosition(l, idPosition, (p) => ({ ...p, ...patch })))
    );
    return writeConfig({ ...config, zones });
  },

  async getPosition(idPosition) {
    await delay();
    const config = readConfig();
    for (const z of config.zones) {
      for (const l of z.lines) {
        const found = l.positions.find((p) => p.idPosition === idPosition);
        if (found) return withDerivedStock(found);
      }
    }
    return null;
  },

  // Asigna o limpia el producto en una posición. En backend esto NO existe a
  // nivel de warehouse; se hace desde productService.assignLocation(). Lo
  // dejamos en el mock para que el flujo de asignación end-to-end funcione
  // localmente sin tocar el productService (cuando se prenda el backend, el
  // productService toma el control y este método deja de usarse).
  // `currentStock` se ignora a propósito: la cantidad de unidades vive en
  // stockPositions y se deriva al leer la posición. Lo aceptamos en la firma
  // para que la llamada del service pueda pasarlo sin romper, pero no se
  // persiste acá.
  // eslint-disable-next-line no-unused-vars
  async setAssignedProduct(idPosition, productSummary, currentStock) {
    await delay();
    const config = readConfig();
    const zones = config.zones.map((z) => ({
      ...z,
      lines: z.lines.map((l) => ({
        ...l,
        positions: l.positions.map((p) =>
          p.idPosition === idPosition ? { ...p, assignedProduct: productSummary || null } : p
        ),
      })),
    }));
    const written = writeConfig({ ...config, zones });
    // Devolvemos el árbol con currentStock derivado para que el caller no
    // tenga que llamar a get() de nuevo.
    return {
      ...written,
      zones: written.zones.map((z) => ({
        ...z,
        lines: z.lines.map((l) => ({
          ...l,
          positions: l.positions.map(withDerivedStock),
        })),
      })),
    };
  },
};

