/*
|--------------------------------------------------------------------------
| WAREHOUSE CONFIG SERVICE
|--------------------------------------------------------------------------
|
| Persiste la configuración del warehouse en localStorage.
|
| Estructura:
|   {
|     zones: [
|       {
|         id, name, color,
|         lines, positions, heights,     // defaults a nivel zona
|         lineOverrides: { "1": { positions: 22 }, ... },
|         positionOverrides: { "L1-P3": { height: 6 }, ... },
|         locationData: { "L1-P3-H2": { capacity: 120 }, ... },
|       }
|     ]
|   }
|
| Cuando se conecte el backend, reemplazar cada método por una llamada a
| `apiClient` (ver patrón en productService.js). El shape de retorno debe
| mantenerse para no romper la UI.
|
*/

import { localStore } from "../lib/localStore";

const KEY = "warehouse_config";

const DEFAULT_CONFIG = {
  zones: [
    { id: "A", name: "Zona A", color: "a", lines: 4, positions: 12, heights: 4 },
    { id: "B", name: "Zona B", color: "b", lines: 4, positions: 18, heights: 4 },
    { id: "C", name: "Zona C", color: "c", lines: 4, positions: 18, heights: 4 },
    { id: "D", name: "Zona D", color: "d", lines: 4, positions: 18, heights: 4 },
  ],
};

const ensureDefaults = (zone) => ({
  color: (zone.id || "").toLowerCase(),
  lineOverrides: {},
  positionOverrides: {},
  locationData: {},
  ...zone,
});

const readConfig = () => {
  const raw = localStore.get(KEY, null);
  if (!raw) {
    localStore.set(KEY, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return { ...raw, zones: (raw.zones || []).map(ensureDefaults) };
};

const writeConfig = (config) => {
  localStore.set(KEY, config);
  return config;
};

const positionKey = (line, position) => `L${line}-P${position}`;
const cellKey = (line, position, height) => `L${line}-P${position}-H${height}`;

const nextZoneId = (zones) => {
  const used = new Set(zones.map((z) => z.id));
  for (let code = 65; code <= 90; code += 1) {
    const id = String.fromCharCode(code);
    if (!used.has(id)) return id;
  }
  return `Z${zones.length + 1}`;
};

export const warehouseConfigService = {
  get() {
    return readConfig();
  },

  save(config) {
    return writeConfig(config);
  },

  /* ---------- Zonas ---------- */

  updateZone(zoneId, patch) {
    const config = readConfig();
    const zones = config.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z));
    return writeConfig({ ...config, zones });
  },

  setZoneLines(zoneId, lines) {
    return this.updateZone(zoneId, { lines: Math.max(1, Number(lines) || 1) });
  },

  addZone({ name } = {}) {
    const config = readConfig();
    const id = nextZoneId(config.zones);
    const palette = ["a", "b", "c", "d"];
    const color = palette[config.zones.length % palette.length];
    const newZone = ensureDefaults({
      id,
      name: name || `Zona ${id}`,
      color,
      lines: 4,
      positions: 18,
      heights: 4,
    });
    return writeConfig({ ...config, zones: [...config.zones, newZone] });
  },

  removeZone(zoneId) {
    const config = readConfig();
    return writeConfig({ ...config, zones: config.zones.filter((z) => z.id !== zoneId) });
  },

  /* ---------- Líneas ---------- */

  getLineConfig(zoneId, line) {
    const zone = readConfig().zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    const override = zone.lineOverrides?.[String(line)] || {};
    return {
      positions: override.positions ?? zone.positions,
    };
  },

  updateLine(zoneId, line, patch) {
    const config = readConfig();
    const zones = config.zones.map((z) => {
      if (z.id !== zoneId) return z;
      const lineOverrides = { ...(z.lineOverrides || {}) };
      lineOverrides[String(line)] = {
        ...(lineOverrides[String(line)] || {}),
        ...patch,
      };
      return { ...z, lineOverrides };
    });
    return writeConfig({ ...config, zones });
  },

  /* ---------- Posiciones ---------- */

  getPositionConfig(zoneId, line, position) {
    const zone = readConfig().zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    const override = zone.positionOverrides?.[positionKey(line, position)] || {};
    return {
      height: override.height ?? zone.heights,
    };
  },

  updatePosition(zoneId, line, position, patch) {
    const config = readConfig();
    const zones = config.zones.map((z) => {
      if (z.id !== zoneId) return z;
      const positionOverrides = { ...(z.positionOverrides || {}) };
      const key = positionKey(line, position);
      positionOverrides[key] = {
        ...(positionOverrides[key] || {}),
        ...patch,
      };
      return { ...z, positionOverrides };
    });
    return writeConfig({ ...config, zones });
  },

  /* ---------- Datos de ubicación (capacidad por celda) ---------- */

  getLocationData(zoneId, line, position, height) {
    const zone = readConfig().zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    return zone.locationData?.[cellKey(line, position, height)] || null;
  },

  updateLocationData(zoneId, line, position, height, patch) {
    const config = readConfig();
    const zones = config.zones.map((z) => {
      if (z.id !== zoneId) return z;
      const locationData = { ...(z.locationData || {}) };
      const key = cellKey(line, position, height);
      locationData[key] = {
        ...(locationData[key] || {}),
        ...patch,
      };
      return { ...z, locationData };
    });
    return writeConfig({ ...config, zones });
  },

  /* ---------- Helpers ---------- */

  buildLocationCode({ zone, line, height, position }) {
    if (!zone || !line || !height || !position) return null;
    return `${zone}-L${String(line).padStart(2, "0")}-P${String(position).padStart(2, "0")}-H${String(height).padStart(2, "0")}`;
  },
};
