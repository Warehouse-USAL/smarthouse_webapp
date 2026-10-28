import { describe, expect, it } from "vitest";
import { errorText } from "./apiError";

const apiError = (code, message) => ({ response: { data: { error: { code, message } } } });

describe("errorText", () => {
  it("prefiere el mensaje de la pantalla", () => {
    expect(errorText(apiError("STOCK_CHANGE_CONFLICT", "x"), { STOCK_CHANGE_CONFLICT: "propio" })).toBe(
      "propio"
    );
  });

  it.each([
    "RESTOCK_ORDER_ALREADY_CANCELLED",
    "RESTOCK_ORDER_HAS_RECEPTIONS",
    "RESTOCK_ORDER_CANCELLED",
    "PROVIDER_WITHOUT_SUPPLIER",
    "SUPPLIER_REQUIRED",
    "STOCK_CHANGE_CONFLICT",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    "DATABASE_UNAVAILABLE",
  ])("traduce %s aunque el backend mande el código crudo", (code) => {
    const text = errorText(apiError(code, code));
    expect(text).not.toBe(code);
    expect(text).toMatch(/\s/);
  });

  it("sin cambios para códigos desconocidos", () => {
    expect(errorText(apiError("OTRO", "mensaje backend"), {}, "fb")).toBe("mensaje backend");
    expect(errorText(new Error("red"), {}, "fb")).toBe("fb");
  });
});
