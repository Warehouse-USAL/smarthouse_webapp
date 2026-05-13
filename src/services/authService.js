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
| 3. Configurar VITE_API_URL
|
*/




const API_URL = import.meta.env.VITE_API_URL;

export async function login(email, password) {

  try {

    const response = await fetch(
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