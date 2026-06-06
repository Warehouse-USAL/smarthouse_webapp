import { localStore } from "../../lib/localStore";

const KEY = "mock_products";

const SEED = [
  {
    id: "PROD-001",
    sku: "SKU-ABC-123",
    name: "Chupetin Bazooka",
    description: "Chupetín sabor frutilla.",

    category: "CHUPETINES",

    images: [
      {
        url: "https://imgs.search.brave.com/YKke6v3DNmYtozajM5wsPNgGIwp17JJmLHIxVhOGbw8/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9odHRw/Mi5tbHN0YXRpYy5j/b20vRF9RX05QXzJY/XzkxNjU1Ni1NTFU3/NTgzNzk5NTgxNl8w/NDIwMjQtVi53ZWJw",
        alt: "Chupetin Bazooka",
        is_primary: true,
      },
    ],

    price: {
      amount_cents: 15000,
      currency: "ARS",
      tax_included: true,
    },

    specs: [
      { label: "Alto",       value: "10 cm" },
      { label: "Ancho",      value: "4 cm"  },
      { label: "Profundidad",value: "2 cm"  },
      { label: "Peso",       value: "15 g"  },
    ],

    stock: {
      available: 120,
      reserved: 30,
      min: 10,
    },

    order_constraints: {
      max_quantity_per_order: 50,
    },

    location: null,

    active: true,

    created_at: "2026-05-01T00:00:00Z",
  },

  {
    id: "PROD-002",
    sku: "SKU-GOL-001",
    name: "Caramelo Masticable",
    description: "Caramelo sabor limón.",

    category: "GOLOSINAS",

    images: [
      {
        url: "https://imgs.search.brave.com/av5Bf-Dk3UhxUfBFcxBX4N8xG1ns-UxrmcG4ys0w2z0/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93d3cu/dmlkYWxnb2xvc2lu/YXMuY29tL21lZGlh/L2NhdGFsb2cvcHJv/ZHVjdC9jYWNoZS8w/Mjk2ZTMwZGZkY2Q1/ZTk1MDlkNzc0M2U1/ZDM4MjE5Ni9tL2Uv/bWVsb25lcy1lc3R1/Y2hlLWVudnVlbHRh/cy04MDBnLWNoaWNs/ZXMtb25saW5lLTEt/MjQuanBn",
        alt: "Caramelo Masticable",
        is_primary: true,
      },
    ],

    price: {
      amount_cents: 9000,
      currency: "ARS",
      tax_included: true,
    },

    specs: [
      { label: "Alto",       value: "8 cm" },
      { label: "Ancho",      value: "3 cm" },
      { label: "Profundidad",value: "1 cm" },
      { label: "Peso",       value: "10 g" },
    ],

    stock: {
      available: 300,
      reserved: 0,
      min: 20,
    },

    order_constraints: {
      max_quantity_per_order: 100,
    },

    location: null,

    active: true,

    created_at: "2026-05-02T00:00:00Z",
  },
];

const readAll = () => localStore.get(KEY, SEED);
const writeAll = (list) => localStore.set(KEY, list);

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const nextId = (list) => {
  const max = list
    .map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `PROD-${String(max + 1).padStart(3, "0")}`;
};

/**
 * Normaliza el input de imágenes.
 * Acepta tanto el formato del contrato (images[]) como una
 * imageUrl string suelta (compatibilidad con formularios que aún no migraron).
 */
const normalizeImages = (input) => {
  if (Array.isArray(input.images) && input.images.length > 0) {
    return input.images;
  }
  if (input.imageUrl) {
    return [{ url: input.imageUrl, alt: input.name || "", is_primary: true }];
  }
  return [];
};

export const productMockService = {
  async list() {
    await delay();
    return readAll();
  },

  async get(id) {
    await delay();
    return readAll().find((p) => p.id === id) || null;
  },

  async getCategories() {
    await delay();
    return ["CHUPETINES", "GOLOSINAS", "SNACKS", "BEBIDAS"];
  },

  async create(input) {
    await delay();

    const list = readAll();

    if (list.some((p) => p.sku === input.sku)) {
      throw {
        response: {
          data: {
            error: {
              code: "SKU_ALREADY_EXISTS",
              message: "Ya existe un producto con ese SKU.",
            },
          },
        },
      };
    }

    const created = {
      id: nextId(list),

      sku: input.sku,
      name: input.name,
      description: input.description || "",
      category: input.category,

      // ✅ Array de imágenes según contrato
      images: normalizeImages(input),

      price: input.price || {
        amount_cents: 0,
        currency: "ARS",
        tax_included: true,
      },

      specs: input.specs || [],

      stock: {
        available: 0,
        reserved: 0,
        min: 0,
      },

      order_constraints: {
        max_quantity_per_order:
          input?.order_constraints?.max_quantity_per_order || 0,
      },

      location: null,

      active: true,

      created_at: new Date().toISOString(),
    };

    writeAll([...list, created]);
    return created;
  },

  async update(id, patch) {
    await delay();

    const list = readAll();
    const idx = list.findIndex((p) => p.id === id);

    if (idx === -1) {
      throw {
        response: {
          data: {
            error: {
              code: "PRODUCT_NOT_FOUND",
              message: "Producto no encontrado.",
            },
          },
        },
      };
    }

    // Si el patch trae imageUrl suelta, convertirla antes de persistir
    const normalizedPatch = { ...patch };
    if (patch.imageUrl !== undefined) {
      normalizedPatch.images = [
        { url: patch.imageUrl, alt: patch.name || list[idx].name, is_primary: true },
      ];
      delete normalizedPatch.imageUrl;
    }

    const updated = [...list];
    updated[idx] = { ...updated[idx], ...normalizedPatch };

    writeAll(updated);
    return updated[idx];
  },

  /**
   * Asigna o actualiza la ubicación física de un producto.
   * location debe cumplir la forma del contrato:
   * { id_position, id_line, id_zone, position_name, zone_code, number_line }
   */
  async assignLocation(productId, location) {
    return this.update(productId, { location });
  },

  async remove(id) {
    await delay();

    const list = readAll();
    const idx = list.findIndex((p) => p.id === id);

    if (idx === -1) {
      throw {
        response: {
          data: {
            error: {
              code: "PRODUCT_NOT_FOUND",
              message: "Producto no encontrado.",
            },
          },
        },
      };
    }

    const updated = [...list];
    updated[idx] = { ...updated[idx], active: false };

    writeAll(updated);
  },
};