/*
|--------------------------------------------------------------------------
| ERRORES DE LA API
|--------------------------------------------------------------------------
|
| El backend responde SIEMPRE con la misma forma (GlobalExceptionHandler):
|
|   { "error": { "code": "STOCK_EXCEEDS_CAPACITY", "message": "..." } }
|
| `message` ya viene en español para los códigos que el backend conoce; para el
| resto repite el código crudo.
|
| Leer `data.error` directo devuelve el OBJETO, y pasarlo como texto a un
| componente hace que React tire "Objects are not valid as a React child".
| Por eso el acceso al error pasa por acá y no a mano en cada catch.
*/

export const errorCode = (e) => {
  const code = e?.response?.data?.error?.code;
  return typeof code === "string" ? code : null;
};

export const errorMessage = (e) => {
  const message = e?.response?.data?.error?.message;
  return typeof message === "string" ? message : null;
};

/*
| Mensajes comunes a todas las pantallas para códigos que el backend agregó
| después (algunos llegan con el código crudo como `message`, p. ej.
| PROVIDER_WITHOUT_SUPPLIER). Un backend viejo nunca los manda, así que no
| cambian nada contra él.
*/
export const COMMON_ERROR_MESSAGES = {
  RESTOCK_ORDER_ALREADY_CANCELLED: "La orden de restock ya estaba cancelada.",
  RESTOCK_ORDER_HAS_RECEPTIONS:
    "No se puede cancelar la orden: ya tiene remitos registrados.",
  RESTOCK_ORDER_CANCELLED:
    "La orden de restock está cancelada y no admite nuevos remitos.",
  PROVIDER_WITHOUT_SUPPLIER:
    "Tu usuario de proveedor no tiene un proveedor asignado. Pedile a un administrador que lo configure.",
  SUPPLIER_REQUIRED: "Indicá el proveedor.",
  STOCK_CHANGE_CONFLICT:
    "Otro cambio de stock se estaba aplicando al mismo tiempo. Reintentá la operación.",
  IDEMPOTENCY_REQUEST_IN_PROGRESS:
    "La solicitud todavía se está procesando. Esperá unos segundos y reintentá.",
  DATABASE_UNAVAILABLE:
    "La base de datos no está disponible en este momento. Reintentá en unos minutos.",
};

/*
| Texto a mostrar, en orden de preferencia:
|   1. el mensaje propio de la pantalla para ese código (más específico y con
|      el vocabulario de la pantalla),
|   2. el mensaje común para ese código (COMMON_ERROR_MESSAGES),
|   3. el mensaje que mandó el backend,
|   4. el fallback genérico.
*/
export const errorText = (e, messages = {}, fallback = "Algo salió mal. Intentá de nuevo.") => {
  const code = errorCode(e);
  return (
    (code && (messages[code] || COMMON_ERROR_MESSAGES[code])) ||
    errorMessage(e) ||
    fallback
  );
};
