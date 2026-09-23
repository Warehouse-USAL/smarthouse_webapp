/*
|--------------------------------------------------------------------------
| PRODUCT SERVICE
|--------------------------------------------------------------------------
|
| Contrato REAL del backend (wh-backend, ProductController):
|   GET    /products            params: category, search, is_active, page, size
|   GET    /products/:id        params: is_active
|   POST   /products            CreateProductRequest
|   PATCH  /products/:id        UpdateProductRequest (parcial)
|   DELETE /products/:id        baja lógica (active=false)
|   GET    /products/:id/location → { locations: [...] }  (array)
|
| El backend serializa en snake_case (JacksonConfig SNAKE_CASE). Este service
| es el único dueño de la traducción camelCase (UI) ↔ snake_case (cable).
|
| `category` es un enum del backend (ProductCategory: TECNOLOGIA, HERRAMIENTAS,
| ALIMENTOS, OTROS). Viaja como string con el nombre del enum y el backend lo
| valida (case-insensitive) en listado/alta/edición → 400 INVALID_CATEGORY si no
| coincide. categoryService trae la lista viva con GET /products/categories.
|
| NO existe en el backend (se ignora / se resuelve en el front):
|   - PATCH /products/:id/location  → la asignación se hace por posición
|     (warehouseConfigService.assignProductToPosition / PATCH positions)
|   - stock no se envía: el backend lo computa desde current_stock de las
|     posiciones. Solo `minimum_stock` viaja en el alta/edición.
|
| Las dimensiones viajan como campos sueltos obligatorios: height/width/length
| (cm) y weight, todos @NotNull @Min(0) en el backend. NO van dentro de `specs`
| (specs queda para atributos libres). El backend además devuelve `volume`
| calculado. Se eliminó unitsPerPallet/HalfPallet/Box (ya no hay asignación auto).
|
*/

import { apiClient } from "../lib/apiClient";
import { categoryService } from "./categoryService";
import { productMockService } from "./mocks/productMockService";

// Backend same-origin vía proxy de Vite: el único interruptor es el flag.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// El backend clampea `size` a 50 (ProductController).
const PRODUCT_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGES = 20;

// Tope de productos que `listAll` trae de una. Llegar acá no es un error: es la
// señal de que la pantalla ya no puede resolver el catálogo entero en memoria y
// necesita paginar de verdad. Quien lo consuma avisa, no explota.
export const PRODUCT_CATALOG_LIMIT = PRODUCT_PAGE_SIZE * MAX_PRODUCT_PAGES;

/*
|--------------------------------------------------------------------------
| NORMALIZERS
|--------------------------------------------------------------------------
*/

const normalizeLocation = (raw) => {
  if (!raw) return null;

  // Se exponen ambas convenciones: camelCase para lógica nueva y snake_case
  // porque ProductCard.formatLocation lee zone_code/number_line/position_name.
  return {
    idPosition: raw.id_position,
    idLine: raw.id_line,
    idZone: raw.id_zone,
    positionName: raw.position_name,
    zoneCode: raw.zone_code,
    numberLine: raw.number_line,
    currentStock: raw.current_stock ?? 0,
    id_position: raw.id_position,
    id_line: raw.id_line,
    id_zone: raw.id_zone,
    position_name: raw.position_name,
    zone_code: raw.zone_code,
    number_line: raw.number_line,
  };
};

const normalize = (raw) => {
  if (!raw) return null;

  const stock = raw.stock || {};
  const orderConstraints =
    raw.order_constraints ||
    raw.orderConstraints ||
    {};

  return {
    id: raw.id,

    sku: raw.sku,

    name: raw.name,

    description: raw.description,

    category: raw.category,

    imageUrl:
      raw.images?.find((i) => i.is_primary)?.url ??
      raw.images?.[0]?.url ??
      "",

    imageAlt:
      raw.images?.find((i) => i.is_primary)?.alt ??
      raw.images?.[0]?.alt ??
      "",

    // Dimensiones: el backend las devuelve como campos sueltos (cm / peso) más
    // un `volume` calculado. Se exponen en camelCase para el form de edición y
    // bajo los alias alto/ancho/profundidad/peso para vistas que aún los leen.
    height: raw.height ?? null,
    width: raw.width ?? null,
    length: raw.length ?? null,
    weight: raw.weight ?? null,
    volume: raw.volume ?? null,
    alto: raw.height ?? null,
    ancho: raw.width ?? null,
    profundidad: raw.length ?? null,
    peso: raw.weight ?? null,

    active: raw.active,

    createdAt:
      raw.created_at ??
      raw.createdAt,

    availableStock:
      stock.available ?? 0,

    reservedStock:
      stock.reserved ?? 0,

    minimumStock:
      stock.min ?? 0,

    maxQuantityPerOrder:
      orderConstraints.max_quantity_per_order ??
      orderConstraints.maxQuantityPerOrder ??
      0,

    // El listado de productos del backend no trae ubicación; se consulta
    // aparte con getLocations(id). Queda null salvo que el caller la inyecte.
    location:
      normalizeLocation(raw.location),

    // Shape crudo (snake_case) que el formulario de edición consume para
    // reconstruir su estado inicial (price.amount_cents, images[].is_primary,
    // stock.min, order_constraints.max_quantity_per_order, specs).
    images: raw.images ?? [],
    specs: raw.specs ?? [],
    price: raw.price ?? null,
    stock,
    order_constraints: orderConstraints,
  };
};

/*
|--------------------------------------------------------------------------
| PAYLOAD BUILDERS
|--------------------------------------------------------------------------
*/

// El formulario entrega `images` como [{ url, alt, isPrimary | is_primary }],
// `price` como string en unidades (no centavos), `specs` como [{label,value}].
// Aquí se traduce todo al contrato del backend (snake_case + centavos).

const toImagesPayload = (images = []) =>
  images
    .filter((img) => img && img.url)
    .map((img) => ({
      url: img.url,
      alt: img.alt ?? "",
      is_primary: img.isPrimary ?? img.is_primary ?? false,
    }));

const toPricePayload = (input) => ({
  amount_cents: Math.round(Number(input.price ?? 0) * 100),
  currency: (input.currency ?? "ARS").toUpperCase() || "ARS",
  tax_included: input.includesTaxes ?? false,
});

const toSpecsPayload = (specs = []) =>
  specs
    .filter((s) => s && (s.label?.trim?.() ?? s.label) && (s.value?.trim?.() ?? s.value))
    .map((s) => ({ label: s.label.trim(), value: s.value.trim() }));

// Las dimensiones son @NotNull @Min(0) en el backend: height/width/length
// (alto/ancho/largo, en cm) y weight. Viajan como campos sueltos (no en specs). Si falta
// cualquiera, el backend responde 400 "height: must not be null", etc.
const toCreatePayload = (input) => ({
  sku: input.sku,
  name: input.name,
  description: input.description ?? "",
  category: input.category,
  images: toImagesPayload(input.images),
  price: toPricePayload(input),
  specs: toSpecsPayload(input.specs),
  max_quantity_per_order: Number(input.maxQuantityPerOrder) || 0,
  minimum_stock: Number(input.minimumStock) || 0,
  height: Number(input.height) || 0,
  width: Number(input.width) || 0,
  length: Number(input.length) || 0,
  weight: Number(input.weight) || 0,
});

const toUpdatePayload = (input) => {
  const payload = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.category !== undefined) payload.category = input.category;
  if (input.images !== undefined) payload.images = toImagesPayload(input.images);
  if (input.specs !== undefined) payload.specs = toSpecsPayload(input.specs);
  if (input.maxQuantityPerOrder !== undefined)
    payload.max_quantity_per_order = Number(input.maxQuantityPerOrder) || 0;
  if (input.minimumStock !== undefined)
    payload.minimum_stock = Number(input.minimumStock) || 0;
  if (input.active !== undefined) payload.is_active = input.active;
  if (input.height !== undefined) payload.height = Number(input.height) || 0;
  if (input.width !== undefined) payload.width = Number(input.width) || 0;
  if (input.length !== undefined) payload.length = Number(input.length) || 0;
  if (input.weight !== undefined) payload.weight = Number(input.weight) || 0;

  const hasPrice =
    input.price !== undefined ||
    input.currency !== undefined ||
    input.includesTaxes !== undefined;
  if (hasPrice) payload.price = toPricePayload(input);

  return payload;
};

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

export const productService = {
  /*
  | Todas las páginas de una vez.
  |
  | `list` devuelve UNA página (size 50 como máximo, el backend lo clampea), asi
  | que cualquier pantalla que necesite el catálogo completo — cruzar productos
  | contra alertas u órdenes, por ejemplo — tiene que usar esto. Con `list` a
  | secas, el producto 51 en adelante no aparece y las órdenes de esos productos
  | se muestran como "Producto dado de baja" aunque estén activos.
  |
  | Trae hasta PRODUCT_CATALOG_LIMIT. Si devuelve esa cantidad exacta puede haber
  | más sin traer, y la pantalla lo avisa en vez de fallar.
  */
  async listAll(filters = {}) {
    if (USE_MOCK) return this.list(filters);

    const out = [];
    for (let page = 0; page < MAX_PRODUCT_PAGES; page += 1) {
      const items = await this.list({ ...filters, page, size: PRODUCT_PAGE_SIZE });
      out.push(...items);
      if (items.length < PRODUCT_PAGE_SIZE) return out;
    }
    // Se llegó al tope. Se devuelve lo traído en vez de tirar: que el catálogo
    // crezca es normal, y voltear la pantalla entera por eso es peor que
    // mostrarla con un aviso. Quien llama compara contra PRODUCT_CATALOG_LIMIT.
    return out;
  },

  async list({
    category,
    search,
    isActive,
    page = 0,
    size = 50,
  } = {}) {
    if (USE_MOCK) {
      const mocked = await productMockService.list({
        category,
        search,
        isActive,
      });
      return mocked.map(normalize);
    }

    const params = {
      page,
      size,
    };

    if (category)
      params.category = category;

    if (search)
      params.search = search;

    if (isActive !== undefined)
      params.is_active = isActive;

    const { data } =
      await apiClient.get(
        "/products",
        {
          params,
        }
      );

    return (
      data?.products || []
    ).map(normalize);
  },

  async get(id) {
    if (USE_MOCK) {
      return normalize(
        await productMockService.get(id)
      );
    }

    const { data } =
      await apiClient.get(
        `/products/${id}`
      );

    return normalize(
      data?.product ?? data
    );
  },

  // Delegamos en categoryService, que llama a GET /products/categories y le
  // pone las etiquetas en castellano.
  async getCategories() {
    if (USE_MOCK) {
      return productMockService.getCategories();
    }
    return categoryService.list();
  },

  async create(input) {
    if (USE_MOCK) {
      return normalize(
        await productMockService.create(input)
      );
    }

    const { data } =
      await apiClient.post(
        "/products",
        toCreatePayload(input)
      );

    return normalize(
      data?.product ?? data
    );
  },

  async update(id, patch) {
    if (USE_MOCK) {
      return normalize(
        await productMockService.update(id, patch)
      );
    }

    const { data } =
      await apiClient.patch(
        `/products/${id}`,
        toUpdatePayload(
          patch
        )
      );

    return normalize(
      data?.product ?? data
    );
  },

  // Ubicaciones del producto: el backend NO tiene PATCH /products/:id/location.
  // La asignación producto→posición se hace vía warehouseConfigService
  // (PATCH /warehouse/positions/:id). Esto es solo lectura: devuelve dónde está
  // almacenado el producto (GET /products/:id/location → { locations: [...] }).
  async getLocations(id) {
    if (USE_MOCK) {
      const single = await productMockService
        .get(id)
        .then((p) => p?.location)
        .catch(() => null);
      return single ? [normalizeLocation(single)] : [];
    }
    const { data } = await apiClient.get(`/products/${id}/location`);
    return (data?.locations || []).map(normalizeLocation);
  },

  async remove(id) {
    if (USE_MOCK) {
      return productMockService.remove(
        id
      );
    }

    await apiClient.delete(
      `/products/${id}`
    );
  },
};