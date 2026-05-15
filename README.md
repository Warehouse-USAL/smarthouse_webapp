# SmartWarehouse — App Web

Aplicación web desarrollada en React + Vite para la gestión y monitoreo de un warehouse inteligente.

---

# Tecnologías

- React
- Vite
- React Router DOM
- Axios
- WebSocket API
- Vercel

---

# Flujo de trabajo Git

## Estructura de ramas

| Rama | Uso | Regla |
|---|---|---|
| `main` | Producción | Solo contiene versiones estables. No se desarrolla directamente sobre esta rama. |
| `develop` | Desarrollo principal | Base para crear nuevas branches de trabajo. |

---

## Flujo obligatorio de trabajo

| Paso | Acción | Comando / Descripción |
|---|---|---|
| 1 | Crear Issue | Toda tarea debe comenzar con un Issue en GitHub. |
| 2 | Actualizar `develop` | `git checkout develop`<br>`git pull origin develop` |
| 3 | Crear branch nueva | `git checkout -b feature/nombre-feature` |
| 4 | Desarrollar cambios | Trabajar normalmente sobre la nueva branch. |
| 5 | Guardar cambios | `git add .`<br>`git commit -m "feat: descripcion"` |
| 6 | Subir branch | `git push origin feature/nombre-feature` |
| 7 | Crear Pull Request | El PR debe apuntar a `develop`. |
| 8 | Merge final | Una vez probado y aprobado, recién pasa a `main`. |

---

## Ejemplos de nombres de branches

| Tipo | Ejemplo |
|---|---|
| Feature | `feature/login` |
| Feature | `feature/dashboard` |
| Fix | `fix/navbar-responsive` |
| Refactor | `refactor/auth-service` |

---
# Levantar el proyecto por primera vez

## Linux

### Instalar dependencias

Verificar Node.js y npm:

```bash
node -v
npm -v
```

Si no están instalados:

```bash
sudo apt install nodejs npm
```

---

### Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
```

Entrar al proyecto:

```bash
cd smartwarehouse-web
```

---

### Instalar dependencias del proyecto

```bash
npm install
```

---

### Ejecutar entorno de desarrollo

```bash
npm run dev
```

Abrir en el navegador:

```txt
http://localhost:5173
```

---

# Windows

## Instalar previamente

- Node.js
- Git
- Visual Studio Code

---

## Verificar instalación

Abrir PowerShell o CMD:

```bash
node -v
npm -v
git --version
```

---

## Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
```

Entrar al proyecto:

```bash
cd smartwarehouse-web
```

---

## Instalar dependencias

```bash
npm install
```

---

## Ejecutar proyecto

```bash
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

---

# Scripts útiles

```bash
npm run dev      # entorno desarrollo
npm run build    # build producción
npm run preview  # preview local
```