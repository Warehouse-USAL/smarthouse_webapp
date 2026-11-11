# Mejoras — toques finales

> Rama: `feature/toques-finales` | Base: `develop`
> Registro breve de cada cambio o hallazgo del cierre del proyecto.

---

## 1. Login: se quita "¿Querés sumarte como proveedor?"

- Se eliminó el link del login, que apuntaba a `/register-provider`. No hay
  ruta para esa URL y `src/pages/auth/RegisterPage/` es una carpeta vacía; no se
  borró ninguna página.
- Se eliminó también su estilo huérfano (`a.registrar_proveedor`).
- Archivos: `src/pages/auth/LoginPage/LoginPage.jsx`,
  `src/components/auth/LoginForm/LoginForm.css`.

---

## 2. Login: se oculta "¿Olvidaste tu contraseña?" (no hay endpoints)

**Revisado contra:** swagger local (`http://localhost:8080/v3/api-docs`) y
`wh-backend` (`develop`, `cdc58de`, 2026-11-04).

**Endpoints de contraseña que existen:**

| Método | Ruta | Requiere | Uso |
| --- | --- | --- | --- |
| `POST` | `/users/{id}/reset-password` | JWT, rol `SUPERADMIN` o `ADMIN_SYSTEM` | Un admin le pone una contraseña nueva a otro usuario (ya se usa en Usuarios) |
| `POST` | `/users/me/change-password` | JWT | El usuario logueado cambia su propia contraseña |

**Lo que falta:**

- No hay ningún endpoint público (sin login) para pedir el enlace de
  recuperación ni para restablecer la contraseña con un token. En
  `SecurityConfig`, `/auth/login` es el único endpoint público de auth.
- El backend tampoco tiene envío de mails configurado.

**Cambio en el front:** el link "¿Olvidaste tu contraseña?" del login quedó
comentado, no borrado. La página `/forgot-password` (4 pasos, solo visual: no
llama al backend) sigue existiendo, pero ya no se llega desde la UI. Para
reactivarlo hay que descomentar el link y volver a importar `Link` en
`LoginPage.jsx`.

**Para implementarlo, el backend tendría que agregar:**

1. `POST /auth/forgot-password` `{ email }`: genera un token con vencimiento y
   envía el mail.
2. `POST /auth/reset-password` `{ token, new_password }`: valida el token y
   cambia la contraseña.
3. La configuración de mail (SMTP) y estos dos endpoints como públicos en
   `SecurityConfig`.

Mientras tanto, la alternativa es que un admin restablezca la contraseña desde
Usuarios.
