/*
|--------------------------------------------------------------------------
| STOCK POSITION SERVICE
|--------------------------------------------------------------------------
|
| El backend (wh-backend) NO tiene una entidad StockPosicion ni endpoints
| /stock-positions. El modelo real es: cada Position guarda a lo sumo un
| product_id + current_stock. La "asignación de stock" es, por lo tanto, un
| PATCH /warehouse/positions/:id con { product_id, current_stock, is_active }.
|
| Este service mantiene la API que consume StockAssignmentPage (createMany /
| removeByPosition) pero la implementa contra Positions. El campo storageUnit
| no se persiste (no existe en el backend): solo se usa en el front para filtrar
| posiciones compatibles por tamaño.
|
| En modo mock sigue delegando en stockPositionMockService.
|
*/

import { apiClient } from "../lib/apiClient";
import { stockPositionMockService } from "./mocks/stockPositionMockService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const stockPositionService = {
  // Asigna un producto y una cantidad a varias posiciones de una sola vez.
  // entries: [{ productId, idPosition, storageUnit, quantity }]. storageUnit no
  // viaja al backend (no existe ese campo); se ignora.
  async createMany(entries) {
    if (USE_MOCK) return stockPositionMockService.createMany(entries);
    return Promise.all(
      entries.map((e) =>
        apiClient.patch(`/warehouse/positions/${e.idPosition}`, {
          product_id: e.productId,
          current_stock: e.quantity,
          is_active: true,
        })
      )
    );
  },

  // Libera una posición completa (product_id=null, current_stock=0 en backend).
  // Devuelve 0 porque el descuento de stock del producto lo computa el backend.
  async removeByPosition(idPosition) {
    if (USE_MOCK) return stockPositionMockService.removeByPosition(idPosition);
    await apiClient.patch(`/warehouse/positions/${idPosition}`, { unassign_product: true });
    return 0;
  },
};
