import {
  POSITION_SIZES,
  STORAGE_UNITS,
  SIZE_TO_UNIT,
  UNIT_TO_SIZE,
  isCompatible,
  unitsPerPosition,
} from "./storageCompatibility.js";

describe("storageCompatibility", () => {
  describe("SIZE_TO_UNIT / UNIT_TO_SIZE", () => {
    it("mapea cada tamaño de posición a su unidad de almacenamiento (Hito 2 §4.3.2)", () => {
      expect(SIZE_TO_UNIT).toEqual({
        PEQUEÑA: "CAJA",
        MEDIANA: "MEDIO_PALLET",
        GRANDE: "PALLET",
      });
    });

    it("es inverso: convertir tamaño→unidad→tamaño devuelve el tamaño original", () => {
      for (const size of POSITION_SIZES) {
        expect(UNIT_TO_SIZE[SIZE_TO_UNIT[size]]).toBe(size);
      }
    });

    it("cada unidad pertenece al enum de unidades", () => {
      expect(Object.values(SIZE_TO_UNIT)).toEqual(expect.arrayContaining(STORAGE_UNITS));
    });
  });

  describe("isCompatible", () => {
    it("retorna true cuando la unidad matchea el tamaño", () => {
      expect(isCompatible("PEQUEÑA", "CAJA")).toBe(true);
      expect(isCompatible("MEDIANA", "MEDIO_PALLET")).toBe(true);
      expect(isCompatible("GRANDE", "PALLET")).toBe(true);
    });

    it("retorna false cuando no matchea", () => {
      expect(isCompatible("PEQUEÑA", "PALLET")).toBe(false);
      expect(isCompatible("GRANDE", "CAJA")).toBe(false);
    });
  });

  describe("unitsPerPosition", () => {
    it("calcula cuántas unidades entran con floor(volumenTamaño / volumenProducto)", () => {
      expect(unitsPerPosition(48000, "CAJA")).toBe(1);
      expect(unitsPerPosition(24000, "CAJA")).toBe(2);
      expect(unitsPerPosition(1000, "PALLET")).toBe(1800);
    });

    it("retorna Infinity si el producto no tiene volumen (backend sin tope)", () => {
      expect(unitsPerPosition(0, "CAJA")).toBe(Infinity);
      expect(unitsPerPosition(null, "PALLET")).toBe(Infinity);
    });

    it("retorna Infinity si la unidad no es reconocida", () => {
      expect(unitsPerPosition(10, "NO_EXISTE")).toBe(Infinity);
    });
  });
});