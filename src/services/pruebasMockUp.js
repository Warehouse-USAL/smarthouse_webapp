/*
|--------------------------------------------------------------------------
| MOCK LOGIN TEMPORAL
|--------------------------------------------------------------------------
|
| Simula latencia y respuesta del backend.
|
| Usuarios válidos:
|
| admin@test.com
| 1234
|
*/

export async function login(email, password) {

  // simulación delay backend
  await new Promise((resolve) =>
    setTimeout(resolve, 1000)
  );



  /*
  |--------------------------------------------------------------------------
  | MOCK SUCCESS
  |--------------------------------------------------------------------------
  */

  if (
    email === "admin@test.com" &&
    password === "1234"
  ) {

    return {

      token: "jwt_fake_token",

      user: {
        id: "USR-001",
        name: "Juan Pérez",
        email,
        role: "admin_sales",
      },

    };

  }



  /*
  |--------------------------------------------------------------------------
  | MOCK ACCOUNT BLOCKED
  |--------------------------------------------------------------------------
  */

  if (
    email === "blocked@test.com"
  ) {

    throw {
      code: "ACCOUNT_BLOCKED",
      message: "La cuenta fue bloqueada temporalmente.",
    };

  }



  /*
  |--------------------------------------------------------------------------
  | MOCK INVALID CREDENTIALS
  |--------------------------------------------------------------------------
  */

  throw {
    code: "INVALID_CREDENTIALS",
    message: "Credenciales inválidas.",
  };

}