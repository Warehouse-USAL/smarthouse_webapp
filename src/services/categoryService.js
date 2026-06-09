/*
|--------------------------------------------------------------------------
| CATEGORY SERVICE
|--------------------------------------------------------------------------
|
| El backend (wh-backend) NO expone un endpoint de categorías: la categoría es
| un string libre dentro de cada producto (Product.category). Por eso la lista
| de categorías es canónica del front y no depende de mocks ni de la red.
|
| Si en el futuro el backend agrega GET /products/categories, basta cambiar el
| cuerpo de list() para consumirlo.
|
*/

export const CATEGORIES = [
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
  "SEGURIDAD",
  "OTROS",
];

export const categoryService = {
  async list() {
    return CATEGORIES;
  },
};
