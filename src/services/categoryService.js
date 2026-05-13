import { localStore } from "../lib/localStore";

const KEY = "product_categories";

const DEFAULT_CATEGORIES = [
  "Periféricos",
  "Monitores",
  "Cámaras",
  "Sensores",
  "Almacenamiento",
  "Redes",
  "Accesorios",
];

export const categoryService = {
  list() {
    return localStore.get(KEY, DEFAULT_CATEGORIES);
  },

  add(name) {
    const list = this.list();
    if (!name || list.includes(name)) return list;
    const next = [...list, name];
    localStore.set(KEY, next);
    return next;
  },
};
