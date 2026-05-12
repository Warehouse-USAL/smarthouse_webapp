import { localStore } from "../lib/localStore";

const KEY = "warehouse_config";

const DEFAULT_CONFIG = {
  zones: [
    { id: "A", name: "Zona A", lines: 4, positions: 12, heights: 4 },
    { id: "B", name: "Zona B", lines: 4, positions: 18, heights: 4 },
    { id: "C", name: "Zona C", lines: 4, positions: 18, heights: 4 },
    { id: "D", name: "Zona D", lines: 4, positions: 18, heights: 4 },
  ],
};

export const warehouseConfigService = {
  get() {
    return localStore.get(KEY, DEFAULT_CONFIG);
  },

  save(config) {
    localStore.set(KEY, config);
    return config;
  },

  updateZone(zoneId, patch) {
    const config = this.get();
    const zones = config.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z));
    return this.save({ ...config, zones });
  },

  buildLocationCode({ zone, line, height, position }) {
    if (!zone || !line || !height || !position) return null;
    return `${zone}-L${String(line).padStart(2, "0")}-H${String(height).padStart(2, "0")}-P${String(position).padStart(2, "0")}`;
  },
};
