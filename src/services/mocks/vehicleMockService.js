/*
|--------------------------------------------------------------------------
| VEHICLE MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste vehículos en localStorage. Mantiene la misma forma que devuelve
| vehicleService real.
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "mock_vehicles";

const SEED = [
  {
    id: "VEH-1",
    name: "VEH-1",
    status: "IDLE",
    battery: 92,
    positionX: 12.4,
    positionY: 8.1,
  },
  {
    id: "VEH-2",
    name: "VEH-2",
    status: "BUSY",
    battery: 67,
    positionX: 4.2,
    positionY: 15.7,
  },
  {
    id: "VEH-3",
    name: "VEH-3",
    status: "OFFLINE",
    battery: 0,
    positionX: 0,
    positionY: 0,
  },
  {
    id: "VEH-4",
    name: "VEH-4",
    status: "ERROR",
    battery: 23,
    positionX: 9.0,
    positionY: 11.2,
  },
];

const readAll = () => localStore.get(KEY, null) ?? (localStore.set(KEY, SEED), SEED);

const writeAll = (list) => localStore.set(KEY, list);

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const nextId = (list) => {
  const max = list
    .map((v) => parseInt(String(v.id).replace(/\D/g, ""), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `VEH-${max + 1}`;
};

export const vehicleMockService = {
  async list() {
    await delay();
    return readAll();
  },

  async get(id) {
    await delay();
    return readAll().find((v) => v.id === id) || null;
  },

  async register({ name }) {
    await delay();
    const list = readAll();
    if (list.some((v) => v.name === name)) {
      throw { response: { data: { error: { message: "Ya existe un vehículo con ese nombre." } } } };
    }
    const created = {
      id: nextId(list),
      name,
      status: "IDLE",
      battery: 100,
      positionX: 0,
      positionY: 0,
    };
    writeAll([...list, created]);
    return created;
  },

  async update(id, patch) {
    await delay();
    const list = readAll();
    const idx = list.findIndex((v) => v.id === id);
    if (idx === -1) {
      throw { response: { data: { error: { message: "Vehículo no encontrado." } } } };
    }
    const updated = { ...list[idx], ...patch };
    const next = [...list];
    next[idx] = updated;
    writeAll(next);
    return updated;
  },

  async remove(id) {
    await delay();
    const list = readAll();
    const next = list.filter((v) => v.id !== id);
    if (next.length === list.length) {
      throw { response: { data: { error: { message: "Vehículo no encontrado." } } } };
    }
    writeAll(next);
  },
};
