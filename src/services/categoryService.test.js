import { describe, expect, it } from "vitest";
import { categoryLabel } from "./categoryService";

describe("categoryLabel", () => {
  it("usa la etiqueta conocida, capitaliza las nuevas y marca la vacía", () => {
    expect(categoryLabel("TECNOLOGIA")).toBe("Tecnología");
    expect(categoryLabel("JUGUETES")).toBe("Juguetes");
    expect(categoryLabel(null)).toBe("—");
  });
});
