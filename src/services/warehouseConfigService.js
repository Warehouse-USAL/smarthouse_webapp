/*
|--------------------------------------------------------------------------
| WAREHOUSE CONFIG SERVICE
|--------------------------------------------------------------------------
|
| Fachada sobre la configuración del warehouse. Cuando VITE_USE_MOCK está
| activo (o no hay VITE_API_BASE_URL), delega en warehouseConfigMockService.
| En modo backend usa apiClient siguiendo el contrato del RFC:
|   GET    /warehouse/zones
|   POST   /warehouse/zones                          { zone_code, max_allowed_lines }
|   PATCH  /warehouse/zones/:id_zone
|   DELETE /warehouse/zones/:id_zone
|   GET    /warehouse/zones/:id_zone/lines
|   POST   /warehouse/zones/:id_zone/lines           { number_line, max_allowed_positions }
|   PATCH  /warehouse/lines/:id_line
|   DELETE /warehouse/lines/:id_line
|   GET    /warehouse/lines/:id_line/positions
|   GET    /warehouse/positions/:id_position
|   POST   /warehouse/lines/:id_line/positions       { position_name, size_stock_to_save }
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
|   - El tamaño se define por posición (position.sizeStockToSave) — cada
|     posición puede tener su propio tamaño dentro de una misma zona/línea.
|     Hubo una versión previa en la que el tamaño vivía en la zona; ya no.
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

// Backend same-origin vía proxy de Vite: el único interruptor es el flag.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// El enum del backend es PEQUENO/MEDIANO/GRANDE (masculino, sin Ñ); el front
// usa PEQUEÑA/MEDIANA/GRANDE. Se traduce en ambos sentidos en el borde.
const SIZE_BE_TO_FE = { PEQUENO: "PEQUEÑA", MEDIANO: "MEDIANA", GRANDE: "GRANDE" };
const SIZE_FE_TO_BE = { PEQUEÑA: "PEQUENO", MEDIANA: "MEDIANO", GRANDE: "GRANDE" };

// Defaults al materializar estructura. El backend NO auto-genera hijos: zonas,
// líneas y posiciones se crean explícitamente y nacen inactivas (is_active=false).
const DEFAULT_MAX_ALLOWED_LINES = 4;
const DEFAULT_MAX_ALLOWED_POSITIONS = 12;
const DEFAULT_POSITION_SIZE = "MEDIANA"; // dominio front (con Ñ)
// CreatePositionRequest exige maximum_capacity >= 1. El front todavía no modela
// capacidad por posición (planAllocation usa las unidades del producto, no este
// tope), así que usamos un default generoso para no bloquear asignaciones.
const DEFAULT_POSITION_CAPACITY = 1000;

const padNumber = (value, width = 2) => {
  const str = String(value ?? "");
  if (!str) return "";
  if (/^\d+$/.test(str)) return str.padStart(width, "0");
  return str;
};

export const POSITION_SIZES = ["PEQUEÑA", "MEDIANA", "GRANDE"];

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
    lines: [],
  };
};

const normalizeLine = (raw) => ({
  idLine: raw.id_line ?? raw.idLine,
  idZone: raw.id_zone ?? raw.idZone,
  numberLine: raw.number_line ?? raw.numberLine,
  isActive: raw.is_active ?? raw.isActive ?? false,
  maxAllowedPositions: raw.max_allowed_positions ?? raw.maxAllowedPositions ?? 0,
  positions: [],
});

const normalizePosition = (raw) => {
  const beSize = raw.size_stock_to_save ?? raw.sizeStockToSave ?? "MEDIANO";
  const productId = raw.product_id ?? raw.productId ?? null;
  // El detalle (GET /positions/:id) trae assigned_product con sku/name; el
  // listado (GET /lines/:id/positions) solo trae product_id. Para que la UI
  // pueda detectar ocupación en ambos casos, derivamos assignedProduct de
  // assigned_product si está, o de product_id (parcial: solo id) si no.
  const assigned = raw.assigned_product ?? raw.assignedProduct ?? null;
  const assignedProduct = assigned
    ? { id: assigned.id, sku: assigned.sku, name: assigned.name }
    : productId
      ? { id: productId, sku: null, name: null }
      : null;
  return {
    idPosition: raw.id_position ?? raw.idPosition,
    idLine: raw.id_line ?? raw.idLine,
    idZone: raw.id_zone ?? raw.idZone,
    positionName: raw.position_name ?? raw.positionName,
    isActive: raw.is_active ?? raw.isActive ?? false,
    // Tamaño traducido al dominio del front (con Ñ).
    sizeStockToSave: SIZE_BE_TO_FE[beSize] ?? beSize,
    maximumCapacity: raw.maximum_capacity ?? raw.maximumCapacity ?? 0,
    // Unidades físicas del producto en esta posición (no confundir con
    // product.availableStock, que es el total del producto en todo el warehouse).
    currentStock: raw.current_stock ?? raw.currentStock ?? 0,
    productId,
    assignedProduct,
  };
};

/* ---------- Payload builders camelCase → snake_case ---------- */

const toZonePayload = (patch) => {
  const out = {};
  if (patch.zoneCode !== undefined) out.zone_code = patch.zoneCode;
  if (patch.maxAllowedLines !== undefined) out.max_allowed_lines = patch.maxAllowedLines;
  return out;
};

const toLinePayload = (patch) => {
  const out = {};
  if (patch.numberLine !== undefined) out.number_line = patch.numberLine;
  if (patch.maxAllowedPositions !== undefined) out.max_allowed_positions = patch.maxAllowedPositions;
  return out;
};

const toPositionPayload = (patch) => {
  const out = {};
  if (patch.positionName !== undefined) out.position_name = patch.positionName;
  if (patch.sizeStockToSave !== undefined)
    out.size_stock_to_save = SIZE_FE_TO_BE[patch.sizeStockToSave] ?? patch.sizeStockToSave;
  if (patch.isActive !== undefined) out.is_active = patch.isActive;
  if (patch.currentStock !== undefined) out.current_stock = patch.currentStock;
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

// Listados CRUDOS (incluyen inactivos). El backend hace soft-delete (is_active
// =false) y mantiene índices únicos sobre zone_code, {id_zone, number_line} y
// {id_line, position_name} aun para registros borrados. Por eso, para generar
// códigos/números/nombres sin chocar con esos índices, hay que mirar TODO, no
// solo lo activo.
const fetchRawZones = async () => {
  const { data } = await apiClient.get("/warehouse/zones");
  return (data?.zones || []).map(normalizeZone);
};

const fetchRawLines = async (idZone) => {
  const { data } = await apiClient.get(`/warehouse/zones/${idZone}/lines`);
  return (data?.lines || []).map(normalizeLine);
};

const fetchRawPositions = async (idLine) => {
  const { data } = await apiClient.get(`/warehouse/lines/${idLine}/positions`);
  return (data?.positions || []).map(normalizePosition);
};

// El árbol que consume la UI muestra SOLO lo activo: como el backend no hace
// hard-delete, tratar is_active=false como "borrado/borrador" es lo que hace que
// eliminar (y recortar posiciones) realmente oculte las cosas en el mapa.
const fetchTree = async () => {
  const zones = (await fetchRawZones()).filter((zone) => zone.isActive);

  await Promise.all(
    zones.map(async (zone) => {
      const lines = (await fetchRawLines(zone.idZone)).filter((line) => line.isActive);
      zone.lines = lines;

      await Promise.all(
        lines.map(async (line) => {
          line.positions = (await fetchRawPositions(line.idLine)).filter(
            (position) => position.isActive
          );
        })
      );
    })
  );

  return { zones };
};

const positionIndexFromName = (name) => {
  const match = /(\d+)\s*$/.exec(String(name ?? ""));
  return match ? Number(match[1]) : 0;
};

const activatePosition = (idPosition) =>
  apiClient.patch(`/warehouse/positions/${idPosition}`, { is_active: true });

// Lleva la cantidad de posiciones ACTIVAS de una línea a `target`.
//   - Crecer: primero reactiva posiciones inactivas (soft-deleted) y, si faltan,
//     crea nuevas con nombres por encima del índice más alto ya usado — así no
//     choca con el índice único {id_line, position_name}. Las posiciones nacen
//     inactivas, por lo que se activan tras crearlas.
//   - Recortar: desactiva las sobrantes de la cola (soft-delete del backend).
const materializePositions = async (idLine, target) => {
  const desired = Math.max(0, Number(target) || 0);
  const all = await fetchRawPositions(idLine);
  const active = all.filter((p) => p.isActive);

  if (active.length === desired) return;

  if (active.length > desired) {
    const surplus = active.slice(desired);
    await Promise.all(
      surplus.map((p) =>
        apiClient.patch(`/warehouse/positions/${p.idPosition}`, { is_active: false })
      )
    );
    return;
  }

  let missing = desired - active.length;

  const reusable = all.filter((p) => !p.isActive).slice(0, missing);
  await Promise.all(reusable.map((p) => activatePosition(p.idPosition)));
  missing -= reusable.length;
  if (missing <= 0) return;

  const maxIndex = all.reduce(
    (max, p) => Math.max(max, positionIndexFromName(p.positionName)),
    0
  );
  await Promise.all(
    Array.from({ length: missing }, async (_, i) => {
      const { data: created } = await apiClient.post(`/warehouse/lines/${idLine}/positions`, {
        position_name: `P${String(maxIndex + i + 1).padStart(2, "0")}`,
        maximum_capacity: DEFAULT_POSITION_CAPACITY,
        size_stock_to_save: SIZE_FE_TO_BE[DEFAULT_POSITION_SIZE],
      });
      const idPosition = created?.id_position ?? created?.idPosition;
      if (idPosition) await activatePosition(idPosition);
    })
  );
};

export const warehouseConfigService = {
  async get() {
    if (USE_MOCK) return warehouseConfigMockService.get();
    return fetchTree();
  },

  /* ---------- Zonas ---------- */

  async addZone(input = {}) {
    if (USE_MOCK) return warehouseConfigMockService.addZone(input);
    // Código sobre TODAS las zonas (incl. inactivas): zone_code es único en el
    // backend y no hay hard-delete, así que reusar un código borrado daría 409.
    const rawZones = await fetchRawZones();
    const { data: created } = await apiClient.post("/warehouse/zones", {
      zone_code: input.zoneCode || nextZoneCode(rawZones),
      max_allowed_lines: input.maxAllowedLines ?? DEFAULT_MAX_ALLOWED_LINES,
    });
    // La zona nace inactiva; se activa para poder colgarle líneas (createLine
    // rechaza con 400 ZONE_INACTIVE si la zona no está activa).
    const idZone = created?.id_zone ?? created?.idZone;
    if (idZone) await apiClient.patch(`/warehouse/zones/${idZone}`, { is_active: true });
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
    const maxAllowedPositions = input.maxAllowedPositions ?? DEFAULT_MAX_ALLOWED_POSITIONS;
    // Defensa: la zona debe estar activa para aceptar líneas (400 ZONE_INACTIVE).
    // addZone ya la activa; lo reforzamos por si viene de un alta anterior.
    await apiClient.patch(`/warehouse/zones/${idZone}`, { is_active: true });
    // number_line sobre TODAS las líneas de la zona: {id_zone, number_line} es
    // único en el backend y no hay hard-delete.
    const rawLines = await fetchRawLines(idZone);
    const nextNumberLine =
      input.numberLine ?? rawLines.reduce((max, l) => Math.max(max, l.numberLine || 0), 0) + 1;
    const { data: created } = await apiClient.post(`/warehouse/zones/${idZone}/lines`, {
      number_line: nextNumberLine,
      max_allowed_positions: maxAllowedPositions,
    });
    // La línea nace inactiva; se activa para aceptar posiciones (createPosition
    // rechaza con 400 LINE_INACTIVE) y luego se materializan sus posiciones.
    const idLine = created?.id_line ?? created?.idLine;
    if (idLine) {
      await apiClient.patch(`/warehouse/lines/${idLine}`, { is_active: true });
      await materializePositions(idLine, maxAllowedPositions);
    }
    return fetchTree();
  },

  async updateLine(idZone, idLine, patch) {
    if (USE_MOCK) return warehouseConfigMockService.updateLine(idZone, idLine, patch);
    await apiClient.patch(`/warehouse/lines/${idLine}`, toLinePayload(patch));
    // En la UI "posiciones permitidas" ES la cantidad real de posiciones, así que
    // materializamos para que el conteo coincida (crea/reactiva o recorta).
    if (patch.maxAllowedPositions !== undefined) {
      await materializePositions(idLine, patch.maxAllowedPositions);
    }
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

  // Asigna un producto a una posición. La fuente de verdad en el backend es la
  // propia Position (product_id + current_stock). Se activa la posición al
  // ocuparla. El backend rechaza con 409 si ya tiene OTRO producto: en ese caso
  // hay que limpiar primero (la UI filtra posiciones ocupadas, así que no
  // debería pasar en el flujo normal).
  async assignProductToPosition(idPosition, productSummary, currentStock) {
    if (USE_MOCK) {
      return warehouseConfigMockService.setAssignedProduct(
        idPosition,
        productSummary,
        currentStock
      );
    }
    await apiClient.patch(`/warehouse/positions/${idPosition}`, {
      product_id: productSummary?.id,
      current_stock: currentStock ?? 0,
      is_active: true,
    });
    return null;
  },

  // Libera la posición: el backend pone product_id=null y current_stock=0. El
  // available del producto baja solo (se computa de las posiciones).
  async clearProductFromPosition(idPosition) {
    if (USE_MOCK) return warehouseConfigMockService.setAssignedProduct(idPosition, null);
    await apiClient.patch(`/warehouse/positions/${idPosition}`, { unassign_product: true });
    return null;
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
