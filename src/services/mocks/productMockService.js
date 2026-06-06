import { localStore } from "../../lib/localStore";

const KEY = "mock_products";

const SEED = [
  {
    id: "PROD-001",
    sku: "SKU-ALI-001",
    name: "Fideos Spaghetti 500g",
    description: "Fideos de sémola de trigo candeal, corte spaghetti. Cocción al dente en 8 minutos.",
    category: "ALIMENTOS",
    images: [
      { url: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400", alt: "Fideos spaghetti paquete", is_primary: true },
      { url: "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400", alt: "Fideos cocidos en olla", is_primary: false },
      { url: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400", alt: "Plato de pasta", is_primary: false },
      { url: "https://images.unsplash.com/photo-1567608285969-48e4bbe0d399?w=400", alt: "Ingredientes pasta", is_primary: false },
      { url: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400", alt: "Fideos secos detalle", is_primary: false },
    ],
    price: { amount_cents: 120000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "28 cm" },
      { label: "Ancho",       value: "6 cm"  },
      { label: "Profundidad", value: "4 cm"  },
      { label: "Peso",        value: "500 g" },
    ],
    stock: { available: 240, reserved: 40, min: 50 },
    order_constraints: { max_quantity_per_order: 120 },
    location: null,
    active: true,
    created_at: "2026-04-01T00:00:00Z",
  },

  {
    id: "PROD-002",
    sku: "SKU-BEB-001",
    name: "Agua Mineral 1.5L",
    description: "Agua mineral natural sin gas, botella de PET reciclable. Sin sodio agregado.",
    category: "BEBIDAS",
    images: [
      { url: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400", alt: "Botella agua mineral", is_primary: true },
      { url: "https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400", alt: "Agua cristalina", is_primary: false },
      { url: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400", alt: "Botellas en estante", is_primary: false },
      { url: "https://images.unsplash.com/photo-1606168094336-48f205522b4e?w=400", alt: "Agua con hielo", is_primary: false },
      { url: "https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=400", alt: "Botella detalle tapa", is_primary: false },
    ],
    price: { amount_cents: 85000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "32 cm" },
      { label: "Ancho",       value: "9 cm"  },
      { label: "Profundidad", value: "9 cm"  },
      { label: "Peso",        value: "1.5 kg" },
    ],
    stock: { available: 500, reserved: 100, min: 100 },
    order_constraints: { max_quantity_per_order: 200 },
    location: null,
    active: true,
    created_at: "2026-04-02T00:00:00Z",
  },

  {
    id: "PROD-003",
    sku: "SKU-ELE-001",
    name: "Smartphone Samsung Galaxy A15",
    description: "Smartphone 6.5 pulgadas, 128GB almacenamiento, 4GB RAM, cámara triple 50MP, batería 5000mAh.",
    category: "ELECTRONICA",
    images: [
      { url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400", alt: "Smartphone frontal", is_primary: true },
      { url: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400", alt: "Smartphone lateral", is_primary: false },
      { url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400", alt: "Smartphone en mano", is_primary: false },
      { url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400", alt: "Detalle cámara trasera", is_primary: false },
      { url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", alt: "Pantalla encendida", is_primary: false },
    ],
    price: { amount_cents: 28000000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "16.7 cm" },
      { label: "Ancho",       value: "7.8 cm"  },
      { label: "Profundidad", value: "0.8 cm"  },
      { label: "Peso",        value: "197 g"   },
    ],
    stock: { available: 35, reserved: 10, min: 5 },
    order_constraints: { max_quantity_per_order: 10 },
    location: null,
    active: true,
    created_at: "2026-04-05T00:00:00Z",
  },

  {
    id: "PROD-004",
    sku: "SKU-LIM-001",
    name: "Detergente Líquido 750ml",
    description: "Detergente concentrado para vajilla, fórmula antibacterial con aloe vera. Rinde hasta 600 lavados.",
    category: "LIMPIEZA",
    images: [
      { url: "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=400", alt: "Detergente botella", is_primary: true },
      { url: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400", alt: "Productos limpieza estante", is_primary: false },
      { url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400", alt: "Limpieza cocina", is_primary: false },
      { url: "https://images.unsplash.com/photo-1600428877878-1a0ff7c4338a?w=400", alt: "Detergente espuma", is_primary: false },
      { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", alt: "Vajilla limpia", is_primary: false },
    ],
    price: { amount_cents: 95000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "24 cm" },
      { label: "Ancho",       value: "8 cm"  },
      { label: "Profundidad", value: "6 cm"  },
      { label: "Peso",        value: "800 g" },
    ],
    stock: { available: 180, reserved: 20, min: 30 },
    order_constraints: { max_quantity_per_order: 60 },
    location: null,
    active: true,
    created_at: "2026-04-08T00:00:00Z",
  },

  {
    id: "PROD-005",
    sku: "SKU-IND-001",
    name: "Remera Básica Algodón Talle M",
    description: "Remera de algodón 100% peinado, talle M, cuello redondo. Disponible en blanco.",
    category: "INDUMENTARIA",
    images: [
      { url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", alt: "Remera blanca frente", is_primary: true },
      { url: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400", alt: "Remera dobladad", is_primary: false },
      { url: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400", alt: "Detalle tela algodón", is_primary: false },
      { url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400", alt: "Remera puesta modelo", is_primary: false },
      { url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400", alt: "Etiqueta talle", is_primary: false },
    ],
    price: { amount_cents: 450000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "72 cm" },
      { label: "Ancho",       value: "52 cm" },
      { label: "Profundidad", value: "1 cm"  },
      { label: "Peso",        value: "180 g" },
    ],
    stock: { available: 90, reserved: 15, min: 20 },
    order_constraints: { max_quantity_per_order: 30 },
    location: null,
    active: true,
    created_at: "2026-04-10T00:00:00Z",
  },

  {
    id: "PROD-006",
    sku: "SKU-FAR-001",
    name: "Ibuprofeno 400mg x 20 comp",
    description: "Antiinflamatorio y analgésico. Ibuprofeno 400mg, caja x 20 comprimidos recubiertos.",
    category: "FARMACIA",
    images: [
      { url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400", alt: "Caja medicamento", is_primary: true },
      { url: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400", alt: "Comprimidos blíster", is_primary: false },
      { url: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400", alt: "Pastillas detalle", is_primary: false },
      { url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400", alt: "Farmacia estante", is_primary: false },
      { url: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=400", alt: "Prospecto medicamento", is_primary: false },
    ],
    price: { amount_cents: 180000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "10 cm" },
      { label: "Ancho",       value: "6 cm"  },
      { label: "Profundidad", value: "2 cm"  },
      { label: "Peso",        value: "45 g"  },
    ],
    stock: { available: 150, reserved: 0, min: 25 },
    order_constraints: { max_quantity_per_order: 50 },
    location: null,
    active: true,
    created_at: "2026-04-12T00:00:00Z",
  },

  {
    id: "PROD-007",
    sku: "SKU-AUT-001",
    name: "Aceite de Motor 10W-40 1L",
    description: "Aceite mineral multigrado para motores nafteros y diesel. Protección contra desgaste y oxidación.",
    category: "AUTOMOTOR",
    images: [
      { url: "https://images.unsplash.com/photo-1635784063388-b4d4b4b4b4e0?w=400", alt: "Bidón aceite motor", is_primary: true },
      { url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400", alt: "Motor de auto", is_primary: false },
      { url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400", alt: "Taller mecánico", is_primary: false },
      { url: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=400", alt: "Cambio de aceite", is_primary: false },
      { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", alt: "Productos automotor estante", is_primary: false },
    ],
    price: { amount_cents: 380000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "22 cm" },
      { label: "Ancho",       value: "10 cm" },
      { label: "Profundidad", value: "10 cm" },
      { label: "Peso",        value: "900 g" },
    ],
    stock: { available: 75, reserved: 10, min: 15 },
    order_constraints: { max_quantity_per_order: 24 },
    location: null,
    active: true,
    created_at: "2026-04-15T00:00:00Z",
  },

  {
    id: "PROD-008",
    sku: "SKU-DEP-001",
    name: "Pelota de Fútbol N°5",
    description: "Pelota de fútbol oficial talle 5, cubierta de PU termosellada, cámara de butilo. Apta para césped natural y sintético.",
    category: "DEPORTES",
    images: [
      { url: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400", alt: "Pelota fútbol campo", is_primary: true },
      { url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400", alt: "Pelota detalle costura", is_primary: false },
      { url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400", alt: "Pelota cancha noche", is_primary: false },
      { url: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=400", alt: "Jugadores fútbol", is_primary: false },
      { url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400", alt: "Pelota césped verde", is_primary: false },
    ],
    price: { amount_cents: 1200000, currency: "ARS", tax_included: true },
    specs: [
      { label: "Alto",        value: "22 cm" },
      { label: "Ancho",       value: "22 cm" },
      { label: "Profundidad", value: "22 cm" },
      { label: "Peso",        value: "430 g" },
    ],
    stock: { available: 60, reserved: 5, min: 10 },
    order_constraints: { max_quantity_per_order: 20 },
    location: null,
    active: true,
    created_at: "2026-04-18T00:00:00Z",
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
  async list({ category, search, isActive } = {}) {
  await delay();

  let results = readAll();

  if (category) {
    results = results.filter((p) => p.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }

  if (isActive !== undefined) {
    results = results.filter((p) => p.active === isActive);
  }

  return results;
},

  async get(id) {
    await delay();
    return readAll().find((p) => p.id === id) || null;
  },

  async getCategories() {
  await delay();
  return [
    "ALIMENTOS",
    "BEBIDAS",
    "LIMPIEZA",
    "HIGIENE_PERSONAL",
    "ELECTRONICA",
    "ELECTRODOMESTICOS",
    "INDUMENTARIA",
    "CALZADO",
    "FERRETERIA",
    "MUEBLES",
    "JUGUETES",
    "LIBRERIA",
    "FARMACIA",
    "MASCOTAS",
    "AUTOMOTOR",
    "DEPORTES",
    "OTROS",
  ];
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

    // Hard delete: filtrar el producto del array
    writeAll(list.filter((p) => p.id !== id));
  },
};