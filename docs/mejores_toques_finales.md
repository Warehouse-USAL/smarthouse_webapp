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
