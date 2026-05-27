/*
|--------------------------------------------------------------------------
| AUTH SERVICE
|--------------------------------------------------------------------------
|
| Este servicio centraliza toda la lógica de autenticación.
|
| Responsabilidades:
| - Login
| - Logout
| - Manejo de JWT
| - Requests autenticadas
|
| Cuando exista el backend:
| - Reemplazar mock por fetch real
| - Configurar URL desde .env
| - Manejar refresh tokens si existen
|
*/







/*
|--------------------------------------------------------------------------
| FUTURA IMPLEMENTACIÓN REAL
|--------------------------------------------------------------------------
|
| Cuando el backend esté listo:
|
| 1. Descomentar esta función
| 2. Eliminar el mock superior
| 3. Configurar VITE_API_BASE_URL
|
*/




import { login as mockLogin } from "./pruebasMockUp";

// Auth tiene su propio interruptor: VITE_USE_MOCK_AUTH. Así podemos tener
// login contra backend real mientras el resto de la app sigue en mock.
// Si VITE_USE_MOCK_AUTH no está seteado, cae al flag global VITE_USE_MOCK.
const API_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const AUTH_MOCK_FLAG = import.meta.env.VITE_USE_MOCK_AUTH;
const USE_MOCK =
  AUTH_MOCK_FLAG !== undefined
    ? AUTH_MOCK_FLAG === "true"
    : import.meta.env.VITE_USE_MOCK === "true";

export async function login(email, password) {

  try {

    // fallback al mock si no hay backend configurado
    if (USE_MOCK) {

      const data = await mockLogin(email, password);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return data;

    }



    let response;

    try {

      response = await fetch(
        `${API_URL}/auth/login`,
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            password,
          }),

        }
      );

    }

    // backend caído / inalcanzable → fallback al mock
    catch (networkError) {

      console.warn(
        "AUTH: backend inalcanzable, usando mock.",
        networkError
      );

      const data = await mockLogin(email, password);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      return data;

    }



    // error backend
    if (!response.ok) {

      const errorData = await response.json();

      throw {
        code: errorData.error.code,
        message: errorData.error.message,
      };

    }



    // success
    const data = await response.json();



    // guardar JWT
    localStorage.setItem(
      "token",
      data.token
    );



    // guardar usuario
    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );



    return data;

  }

  catch (error) {

    console.error(
      "AUTH LOGIN ERROR:",
      error
    );

    throw error;

  }

}







/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
|
| Limpia storage local.
|
*/

export function logout() {

  localStorage.removeItem("token");

  localStorage.removeItem("user");

}





/*
|--------------------------------------------------------------------------
| GET TOKEN
|--------------------------------------------------------------------------
|
| Devuelve JWT almacenado.
|
*/

export function getToken() {

  return localStorage.getItem("token");

}





/*
|--------------------------------------------------------------------------
| GET USER
|--------------------------------------------------------------------------
|
| Devuelve usuario parseado.
|
*/

export function getUser() {

  const user =
    localStorage.getItem("user");

  return user
    ? JSON.parse(user)
    : null;

}





/*
|--------------------------------------------------------------------------
| AUTHENTICATED REQUESTS
|--------------------------------------------------------------------------
|
| Helper para requests protegidas.
|
| Uso futuro:
|
| authFetch("/orders")
|
*/


/*

export async function authFetch(
  endpoint,
  options = {}
) {

  const token = getToken();

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {

      ...options,

      headers: {

        "Content-Type": "application/json",

        Authorization:
          `Bearer ${token}`,

        ...options.headers,

      },

    }
  );



  if (!response.ok) {

    throw await response.json();

  }



  return response.json();

}

*/