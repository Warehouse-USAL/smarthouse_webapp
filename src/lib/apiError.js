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
| Texto a mostrar, en orden de preferencia:
|   1. el mensaje propio de la pantalla para ese código (más específico y con
|      el vocabulario de la pantalla),
|   2. el mensaje que mandó el backend,
|   3. el fallback genérico.
*/
export const errorText = (e, messages = {}, fallback = "Algo salió mal. Intentá de nuevo.") => {
  const code = errorCode(e);
  return (code && messages[code]) || errorMessage(e) || fallback;
};
