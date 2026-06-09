/*
|--------------------------------------------------------------------------
| PRODUCT SERVICE
|--------------------------------------------------------------------------
|
| Contrato tomado de:
| 3.3 Productos
|
| GET    /products
| GET    /products/:id
| GET    /products/categories
| POST   /products
| PATCH  /products/:id
| PATCH  /products/:id/location
| DELETE /products/:id
|
| NOTA:
| - El frontend conserva temporalmente precio y dimensiones
|   (alto/ancho/profundidad/peso) aunque todavía no estén documentados
|   explícitamente en POST/PATCH.
|
| - Se eliminó el concepto de:
|     unitsPerPallet
|     unitsPerHalfPallet
|     unitsPerBox
|
|   porque ya no existe asignación automática.
|
*/

import { apiClient } from "../lib/apiClient";
import { productMockService } from "./mocks/productMockService";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === "true" ||
  !import.meta.env.VITE_API_BASE_URL;

/*
|--------------------------------------------------------------------------
| NORMALIZERS
|--------------------------------------------------------------------------
*/

const normalizeLocation = (raw) => {
  if (!raw) return null;

  return {
    idPosition: raw.id_position,
    idLine: raw.id_line,
    idZone: raw.id_zone,
    positionName: raw.position_name,
    zoneCode: raw.zone_code,
    numberLine: raw.number_line,
  };
};

const normalizeSpecs = (specs = []) => {
  const findValue = (label) =>
    specs.find(
      (s) =>
        s.label?.toLowerCase() === label.toLowerCase()
    )?.value ?? "";

  return {
    alto: findValue("Alto"),
    ancho: findValue("Ancho"),
    profundidad: findValue("Profundidad"),
    peso: findValue("Peso"),
  };
};

const normalize = (raw) => {
  if (!raw) return null;

  const stock = raw.stock || {};
  const price = raw.price || {};
  const orderConstraints =
    raw.order_constraints ||
    raw.orderConstraints ||
    {};

  const dimensions = normalizeSpecs(raw.specs);

  return {
    id: raw.id,

    sku: raw.sku,

    name: raw.name,

    description: raw.description,

    category: raw.category,

    imageUrl:
      raw.image_url ??
      raw.imageUrl ??
      raw.images?.find((i) => i.is_primary)?.url ??
      raw.images?.[0]?.url ??
      "",

    imageAlt:
      raw.images?.find((i) => i.is_primary)?.alt ??
      raw.images?.[0]?.alt ??
      "",

    price:
      price.amount_cents ?? 0,

    currency:
      price.currency ?? "ARS",

    includesTaxes:
      price.tax_included ?? false,

    alto: dimensions.alto,
    ancho: dimensions.ancho,
    profundidad: dimensions.profundidad,
    peso: dimensions.peso,

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

    location:
      normalizeLocation(raw.location),
  };
};

/*
|--------------------------------------------------------------------------
| PAYLOAD BUILDERS
|--------------------------------------------------------------------------
*/

const buildSpecs = (input) => [
  {
    label: "Alto",
    value: input.alto ?? "",
  },
  {
    label: "Ancho",
    value: input.ancho ?? "",
  },
  {
    label: "Profundidad",
    value: input.profundidad ?? "",
  },
  {
    label: "Peso",
    value: input.peso ?? "",
  },
];

const toCreatePayload = (input) => ({
  sku: input.sku,

  name: input.name,

  description:
    input.description ?? "",

  category: input.category,

  image_url:
    input.imageUrl ?? "",

  order_constraints: {
    max_quantity_per_order:
      input.maxQuantityPerOrder ?? 0,
  },

  /*
   * Estos campos no figuran todavía
   * en el ejemplo del endpoint,
   * pero los dejamos preparados.
   */

  price: {
    amount_cents:
      input.price ?? 0,

    currency:
      input.currency ?? "ARS",

    tax_included:
      input.includesTaxes ?? false,
  },

  specs: buildSpecs(input),
});

const toUpdatePayload = (input) => {
  const payload = {};

  if (input.name !== undefined)
    payload.name = input.name;

  if (input.description !== undefined)
    payload.description =
      input.description;

  if (input.category !== undefined)
    payload.category =
      input.category;

  if (input.imageUrl !== undefined)
    payload.image_url =
      input.imageUrl;

  if (
    input.maxQuantityPerOrder !==
    undefined
  ) {
    payload.order_constraints = {
      max_quantity_per_order:
        input.maxQuantityPerOrder,
    };
  }

  const hasSpecs =
    input.alto !== undefined ||
    input.ancho !== undefined ||
    input.profundidad !== undefined ||
    input.peso !== undefined;

  if (hasSpecs) {
    payload.specs =
      buildSpecs(input);
  }

  const hasPrice =
    input.price !== undefined ||
    input.currency !== undefined ||
    input.includesTaxes !==
      undefined;

  if (hasPrice) {
    payload.price = {
      amount_cents:
        input.price ?? 0,

      currency:
        input.currency ??
        "ARS",

      tax_included:
        input.includesTaxes ??
        false,
    };
  }

  return payload;
};

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

export const productService = {
  async list({
    category,
    search,
    isActive,
    page = 0,
    size = 50,
  } = {}) {
    if (USE_MOCK) {
      return productMockService.list({
        category,
        search,
        isActive,
      });
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
      return productMockService.get(
        id
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

  async getCategories() {
    if (USE_MOCK) {
      return productMockService.getCategories();
    }

    const { data } =
      await apiClient.get(
        "/products/categories"
      );

    return (
      data?.categories ?? []
    );
  },

  async create(input) {
    if (USE_MOCK) {
      return productMockService.create(
        input
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
      return productMockService.update(
        id,
        patch
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

  async assignLocation(
    id,
    location
  ) {
    if (USE_MOCK) {
      return productMockService.assignLocation(
        id,
        location
      );
    }

    const { data } =
      await apiClient.patch(
        `/products/${id}/location`,
        {
          location,
        }
      );

    return normalize(
      data?.product ?? data
    );
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