/*
|--------------------------------------------------------------------------
| STOCK POSITION MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste StockPosicion (Hito 2 §9) en localStorage.
|
| StockPosicion = vínculo (producto, posición, unidad de almacenamiento,
| cantidad). Es la tabla intermedia que materializa la asignación de stock
| físico dentro del warehouse.
|
| Shape:
|   {
|     id,             // UUID local
|     productId,
|     idPosition,
|     storageUnit,    // PALLET | MEDIO_PALLET | CAJA
|     quantity,       // unidades del producto almacenadas en esa posición
|     createdAt
|   }
|
| Nota: este mock vive 100% del lado front porque el backend actual NO tiene
| el endpoint. Cuando lo agregue, el service real (stockPositionService.js)
| dejará de delegar aquí y los llamará vía apiClient.
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "mock_stock_positions";

const uid = () =>
  `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const readAll = () => localStore.get(KEY, []) ?? [];
const writeAll = (list) => localStore.set(KEY, list);

export const stockPositionMockService = {
  async list({ productId, idPosition } = {}) {
    await delay();
    let all = readAll();
    if (productId) all = all.filter((sp) => sp.productId === productId);
    if (idPosition) all = all.filter((sp) => sp.idPosition === idPosition);
    return all;
  },

  // Inserta una asignación. Si ya existe (productId + idPosition + storageUnit),
  // suma la cantidad en lugar de duplicar el registro.
  async create({ productId, idPosition, storageUnit, quantity }) {
    await delay();
    const list = readAll();
    const existing = list.find(
      (sp) =>
        sp.productId === productId &&
        sp.idPosition === idPosition &&
        sp.storageUnit === storageUnit
    );
    if (existing) {
      const next = list.map((sp) =>
        sp === existing ? { ...sp, quantity: sp.quantity + Number(quantity) } : sp
      );
      writeAll(next);
      return { ...existing, quantity: existing.quantity + Number(quantity) };
    }
    const created = {
      id: uid(),
      productId,
      idPosition,
      storageUnit,
      quantity: Number(quantity),
      createdAt: new Date().toISOString(),
    };
    writeAll([...list, created]);
    return created;
  },

  // Aplica un plan completo (varias posiciones) en una sola pasada.
  // Devuelve los StockPosicion resultantes.
  async createMany(entries) {
    await delay();
    const results = [];
    for (const e of entries) {
      // Evitamos await dentro del loop reusando readAll/writeAll directo.
      const list = readAll();
      const existing = list.find(
        (sp) =>
          sp.productId === e.productId &&
          sp.idPosition === e.idPosition &&
          sp.storageUnit === e.storageUnit
      );
      if (existing) {
        const next = list.map((sp) =>
          sp === existing ? { ...sp, quantity: sp.quantity + Number(e.quantity) } : sp
        );
        writeAll(next);
        results.push({ ...existing, quantity: existing.quantity + Number(e.quantity) });
      } else {
        const created = {
          id: uid(),
          productId: e.productId,
          idPosition: e.idPosition,
          storageUnit: e.storageUnit,
          quantity: Number(e.quantity),
          createdAt: new Date().toISOString(),
        };
        writeAll([...list, created]);
        results.push(created);
      }
    }
    return results;
  },

  async remove(id) {
    await delay();
    const list = readAll();
    writeAll(list.filter((sp) => sp.id !== id));
  },

  // Borra TODAS las entradas que apuntan a una posición. Útil cuando se
  // vacía una posición (se "quita" el producto). Devuelve el total de
  // unidades que estaban almacenadas ahí — el caller lo necesita para
  // descontar del availableStock del producto.
  async removeByPosition(idPosition) {
    await delay();
    const list = readAll();
    const removed = list.filter((sp) => sp.idPosition === idPosition);
    writeAll(list.filter((sp) => sp.idPosition !== idPosition));
    return removed.reduce((sum, sp) => sum + (Number(sp.quantity) || 0), 0);
  },
};
