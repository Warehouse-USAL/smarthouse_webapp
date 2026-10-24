import { apiClient } from "./apiClient";

/*
| Paginación contra el backend. Todos los listados responden
|   { <key>: [...], pagination: { page, size, total_elements, total_pages } }
| con `page` 0-based y `size` capeado en 50 (PageRequest.of(..., min(size, 50))).
|
| Acá una página es { items, totalPages, totalElements } y `page` es 1-based,
| como la muestra el componente Pagination.
*/

export const MAX_PAGE_SIZE = 50;

const MAX_PAGES = 20;

export const fetchPage = async (url, { page = 1, size = MAX_PAGE_SIZE, ...params }, key, normalizer) => {
  const { data } = await apiClient.get(url, {
    params: { ...params, page: page - 1, size },
  });
  const pagination = data?.pagination ?? {};
  return {
    items: (data?.[key] || []).map(normalizer),
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 0,
    totalElements: pagination.total_elements ?? pagination.totalElements ?? 0,
  };
};

// Para listados ACOTADOS (una ventana de fechas, un estado poco frecuente). No
// sirve para traer un histórico entero: pasado el tope falla en vez de devolver
// datos truncados que se verían completos.
export const fetchAllPages = async (url, params, key, normalizer) => {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { items, totalPages } = await fetchPage(
      url,
      { ...params, page, size: MAX_PAGE_SIZE },
      key,
      normalizer
    );
    out.push(...items);
    if (items.length < MAX_PAGE_SIZE || page >= totalPages) return out;
  }
  throw new Error(
    `El listado ${url} supera los ${MAX_PAGES * MAX_PAGE_SIZE} registros; hay que acotarlo.`
  );
};

// Misma forma que fetchPage, sobre un array ya en memoria (mocks).
export const paginate = (rows, { page = 1, size = MAX_PAGE_SIZE } = {}) => ({
  items: rows.slice((page - 1) * size, page * size),
  totalPages: Math.ceil(rows.length / size),
  totalElements: rows.length,
});

// La UI filtra por día (yyyy-mm-dd, hora local); el backend espera instantes
// ISO-8601 (Instant.parse) y los dos extremos son inclusivos.
export const toInstantRange = ({ from, to, ...rest } = {}) => ({
  ...rest,
  ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
  ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
});

// yyyy-mm-dd en hora local de hace `days` días.
export const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

// Código legible estable sin depender del listado completo: prefijo + últimos
// seis caracteres alfanuméricos del id.
export const displayCode = (prefix, id) =>
  `${prefix}-${String(id ?? "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
