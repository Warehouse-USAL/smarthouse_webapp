/*
|--------------------------------------------------------------------------
| WAREHOUSE CONFIG SERVICE
|--------------------------------------------------------------------------
|
| Fachada sobre la configuración del warehouse. Cuando VITE_USE_MOCK está
| activo (o no hay VITE_API_BASE_URL), delega en warehouseConfigMockService.
| En modo backend usa apiClient siguiendo el contrato del RFC:
|   GET    /warehouse/zones
|   POST   /warehouse/zones                          { zone_code, max_allowed_lines, size_stock_to_save }
|   PATCH  /warehouse/zones/:id_zone
|   DELETE /warehouse/zones/:id_zone
|   GET    /warehouse/zones/:id_zone/lines
|   POST   /warehouse/zones/:id_zone/lines           { number_line, max_allowed_positions }
|   PATCH  /warehouse/lines/:id_line
|   DELETE /warehouse/lines/:id_line
|   GET    /warehouse/lines/:id_line/positions
|   GET    /warehouse/positions/:id_position
|   POST   /warehouse/lines/:id_line/positions       { position_name, maximum_capacity }
|   PATCH  /warehouse/positions/:id_position
|   DELETE /warehouse/positions/:id_position
|
| `get()` orquesta las 3 capas y devuelve el árbol completo en camelCase:
|   { zones: [{ ..., lines: [{ ..., positions: [...] }] }] }
|
| Decisiones de diseño:
|   - name es siempre `Zona ${zoneCode}` (no se persiste en backend).
|   - color es 100% cosmético, asignado en el front por hash estable del
|     idZone (1 de 4 colores: a/b/c/d). No viaja al backend.
|   - El tamaño es por zona (zone.sizeStockToSave), NO por posición. El
|     campo position.size se derivó hasta acá pero ya no se expone — la UI
|     debe leer zone.sizeStockToSave.
|   - assignedProduct: el listado de positions del RFC no lo devuelve. Para
|     ver el producto asignado a una posición, usar getPosition(idPosition)
|     que llama a GET /warehouse/positions/:id (devuelve assigned_product).
|   - Para asignar un producto a una posición, NO se usa este service.
|     Usar productService.assignLocation(idProduct, { idZone, idLine, idPosition })
|     que llama a PATCH /products/:id/location.
|
| El código de ubicación queda como `${zoneCode}-L${numberLine}-P${positionName}`
| (sin altura — los robots trabajan solo a altura cero).
|
*/

import { apiClient } from "../lib/apiClient";
import { warehouseConfigMockService } from "./mocks/warehouseConfigMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" || !import.meta.env.VITE_API_BASE_URL;

const padNumber = (value, width = 2) => {
  const str = String(value ?? "");
  if (!str) return "";
  if (/^\d+$/.test(str)) return str.padStart(width, "0");
  return str;
};

export const ZONE_SIZES = ["PEQUEÑA", "MEDIANA", "GRANDE"];

const COLOR_PALETTE = ["a", "b", "c", "d"];

// Hash determinístico simple sobre el idZone → 1 de 4 colores. Estable entre
// re-renders y entre usuarios, sin tener que persistir el color en backend.
const colorForZone = (idZone) => {
  const key = String(idZone ?? "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
};

/* ---------- Normalizadores snake_case → camelCase ---------- */

const normalizeZone = (raw) => {
  const idZone = raw.id_zone ?? raw.idZone;
  const zoneCode = raw.zone_code ?? raw.zoneCode;
  return {
    idZone,
    zoneCode,
    name: `Zona ${zoneCode ?? ""}`.trim(),
    color: colorForZone(idZone ?? zoneCode),
    isActive: raw.is_active ?? raw.isActive ?? false,
    maxAllowedLines: raw.max_allowed_lines ?? raw.maxAllowedLines ?? 0,
    sizeStockToSave: raw.size_stock_to_save ?? raw.sizeStockToSave ?? "MEDIANA",
    lines: [],
  };
};

const normalizeLine = (raw) => ({
  idLine: raw.id_line ?? raw.idLine,
  numberLine: raw.number_line ?? raw.numberLine,
  isActive: raw.is_active ?? raw.isActive ?? false,
  maxAllowedPositions: raw.max_allowed_positions ?? raw.maxAllowedPositions ?? 0,
  positions: [],
});

const normalizePosition = (raw) => ({
  idPosition: raw.id_position ?? raw.idPosition,
  positionName: raw.position_name ?? raw.positionName,
  isActive: raw.is_active ?? raw.isActive ?? false,
  maximumCapacity: raw.maximum_capacity ?? raw.maximumCapacity ?? 0,
  assignedProduct: raw.assigned_product
    ? {
        id: raw.assigned_product.id,
        sku: raw.assigned_product.sku,
        name: raw.assigned_product.name,
      }
    : null,
});

/* ---------- Payload builders camelCase → snake_case ---------- */

const toZonePayload = (patch) => {
  const out = {};
  if (patch.zoneCode !== undefined) out.zone_code = patch.zoneCode;
  if (patch.isActive !== undefined) out.is_active = patch.isActive;
  if (patch.maxAllowedLines !== undefined) out.max_allowed_lines = patch.maxAllowedLines;
  if (patch.sizeStockToSave !== undefined) out.size_stock_to_save = patch.sizeStockToSave;
  return out;
};

const toLinePayload = (patch) => {
  const out = {};
  if (patch.numberLine !== undefined) out.number_line = patch.numberLine;
  if (patch.isActive !== undefined) out.is_active = patch.isActive;
  if (patch.maxAllowedPositions !== undefined) out.max_allowed_positions = patch.maxAllowedPositions;
  return out;
};

const toPositionPayload = (patch) => {
  const out = {};
  if (patch.positionName !== undefined) out.position_name = patch.positionName;
  if (patch.isActive !== undefined) out.is_active = patch.isActive;
  if (patch.maximumCapacity !== undefined) out.maximum_capacity = patch.maximumCapacity;
  return out;
};

/* ---------- Helpers para el modo backend ---------- */

const nextZoneCode = (zones) => {
  const used = new Set(zones.map((z) => z.zoneCode));
  for (let code = 65; code <= 90; code += 1) {
    const ch = String.fromCharCode(code);
    if (!used.has(ch)) return ch;
  }
  return `Z${zones.length + 1}`;
};

const fetchTree = async () => {
  const { data: zonesRes } = await apiClient.get("/warehouse/zones");
  const zones = (zonesRes?.zones || []).map(normalizeZone);

  await Promise.all(
    zones.map(async (zone) => {
      const { data: linesRes } = await apiClient.get(`/warehouse/zones/${zone.idZone}/lines`);
      zone.lines = (linesRes?.lines || []).map(normalizeLine);

      await Promise.all(
        zone.lines.map(async (line) => {
          const { data: posRes } = await apiClient.get(`/warehouse/lines/${line.idLine}/positions`);
          line.positions = (posRes?.positions || []).map(normalizePosition);
        })
      );
    })
  );

  return { zones };
};

export const warehouseConfigService = {
  async get() {
    if (USE_MOCK) return warehouseConfigMockService.get();
    return fetchTree();
  },

  /* ---------- Zonas ---------- */

  async addZone(input = {}) {
    if (USE_MOCK) return warehouseConfigMockService.addZone(input);
    const tree = await fetchTree();
    const body = {
      zone_code: input.zoneCode || nextZoneCode(tree.zones),
      max_allowed_lines: input.maxAllowedLines ?? 4,
      size_stock_to_save: input.sizeStockToSave || "MEDIANA",
    };
    await apiClient.post("/warehouse/zones", body);
    return fetchTree();
  },

  async updateZone(idZone, patch) {
    if (USE_MOCK) return warehouseConfigMockService.updateZone(idZone, patch);
    await apiClient.patch(`/warehouse/zones/${idZone}`, toZonePayload(patch));
    return fetchTree();
  },

  async removeZone(idZone) {
    if (USE_MOCK) return warehouseConfigMockService.removeZone(idZone);
    await apiClient.delete(`/warehouse/zones/${idZone}`);
    return fetchTree();
  },

  /* ---------- Líneas ---------- */

  async addLine(idZone, input = {}) {
    if (USE_MOCK) return warehouseConfigMockService.addLine(idZone, input);
    const tree = await fetchTree();
    const zone = tree.zones.find((z) => z.idZone === idZone);
    const nextNumberLine =
      input.numberLine ?? (zone?.lines[zone.lines.length - 1]?.numberLine ?? 0) + 1;
    await apiClient.post(`/warehouse/zones/${idZone}/lines`, {
      number_line: nextNumberLine,
      max_allowed_positions: input.maxAllowedPositions ?? 12,
    });
    return fetchTree();
  },

  async updateLine(idZone, idLine, patch) {
    if (USE_MOCK) return warehouseConfigMockService.updateLine(idZone, idLine, patch);
    await apiClient.patch(`/warehouse/lines/${idLine}`, toLinePayload(patch));
    return fetchTree();
  },

  async removeLine(idZone, idLine) {
    if (USE_MOCK) return warehouseConfigMockService.removeLine(idZone, idLine);
    await apiClient.delete(`/warehouse/lines/${idLine}`);
    return fetchTree();
  },

  /* ---------- Posiciones ---------- */

  async updatePosition(idZone, idLine, idPosition, patch) {
    if (USE_MOCK) return warehouseConfigMockService.updatePosition(idZone, idLine, idPosition, patch);
    await apiClient.patch(`/warehouse/positions/${idPosition}`, toPositionPayload(patch));
    return fetchTree();
  },

  // Detalle de una posición individual, incluyendo el producto asignado.
  // Útil para vistas que solo seleccionan una posición — evita refetch del árbol.
  async getPosition(idPosition) {
    if (USE_MOCK) return warehouseConfigMockService.getPosition(idPosition);
    const { data } = await apiClient.get(`/warehouse/positions/${idPosition}`);
    return normalizePosition(data);
  },

  /* ---------- Helpers (sync, locales al árbol) ---------- */

  buildLocationCode({ zoneCode, numberLine, positionName } = {}) {
    if (!zoneCode || !numberLine || !positionName) return null;
    return `${zoneCode}-L${padNumber(numberLine)}-P${padNumber(positionName)}`;
  },

  findZone(config, idZone) {
    return config?.zones?.find((z) => z.idZone === idZone) || null;
  },

  findLine(zone, idLine) {
    return zone?.lines?.find((l) => l.idLine === idLine) || null;
  },

  findPosition(line, idPosition) {
    return line?.positions?.find((p) => p.idPosition === idPosition) || null;
  },
};
