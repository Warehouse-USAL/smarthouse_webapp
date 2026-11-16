# SmartWarehouse · App web

Panel web para gestionar un warehouse inteligente: stock, ubicaciones, ventas,
vehículos y usuarios.

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19 · Vite 8 · React Router 7 · Axios |
| Tests | Vitest |
| Backend | `wh-backend` (Spring Boot + MongoDB), en `:8080` |

**Índice:** [Requisitos](#requisitos) · [Levantar el proyecto](#levantar-el-proyecto) ·
[Solución de problemas](#solución-de-problemas) · [Scripts](#scripts) ·
[Estructura](#estructura) · [Flujo de trabajo Git](#flujo-de-trabajo-git) ·
[Despliegue](#despliegue)

---

## Requisitos

- **Node.js** `^20.19.0` o `>=22.12.0` (lo pide Vite 8)
- **npm** (viene con Node)
- **Git**
- **Docker** con Docker Compose, para levantar el backend

> La app no usa datos mockeados: necesita `wh-backend` corriendo en
> `http://localhost:8080`. Sin backend, el login y las pantallas no cargan.

---

## Levantar el proyecto

### 1. Clonar los dos repositorios

```bash
git clone <URL_DEL_REPO_FRONT> smarthouse_webapp
git clone <URL_DEL_REPO_BACKEND> wh-backend
```

### 2. Levantar el backend

```bash
cd wh-backend
cp .env.example .env
```

Completar en `.env` al menos `JWT_SECRET` (mínimo 32 caracteres) y
`ADMIN_PASSWORD`. Para tener datos de prueba en la primera corrida, poner
`SEED_DEMO=true` (solo funciona sobre una base vacía).

```bash
make up-dev
```

Cuando termine, `http://localhost:8080/swagger-ui/index.html` tiene que cargar.

### 3. Instalar el frontend

```bash
cd ../smarthouse_webapp
npm install
```

### 4. Iniciar el frontend

```bash
npm run dev
```

Abrir **http://localhost:5173/app/**. La app vive bajo `/app/` también en
desarrollo.

Para entrar, usar una cuenta demo de [`docs/credenciales.md`](docs/credenciales.md)
(contraseña compartida `Demo1234!`).

### Windows

- Instalar Node.js (versión LTS), Git y Docker Desktop con WSL 2.
- Los comandos de `npm` y `git` son iguales en PowerShell o en la terminal de VS Code.
- `make` no viene en Windows. `make up-dev` equivale a
  `docker compose --profile dev up --build` (ejecutado desde `wh-backend`), y
  toma las variables de `.env`.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| La app carga pero el login falla con error de red | El backend no está corriendo | Verificar `http://localhost:8080/swagger-ui/index.html` y levantar `make up-dev` |
| Login responde 401 | Cuenta o contraseña incorrecta, o la base no tiene datos demo | Revisar [`docs/credenciales.md`](docs/credenciales.md). `SEED_DEMO` solo corre sobre una base vacía |
| `localhost:5173/` no muestra la app | La base es `/app/` | Abrir `http://localhost:5173/app/` |
| `npm run dev` falla por versión de Node | Node por debajo del mínimo | Instalar Node `^20.19.0` o `>=22.12.0` |
| El puerto 5173 está ocupado | Otro proceso de Vite | `npm run dev -- --port 5174` |

---

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite con recarga en caliente |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve localmente el build de producción |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm test` | Tests unitarios con Vitest |

Antes de abrir un PR, correr los tres que usa el CI:

```bash
npm run lint && npm test && npm run build
```

---

## Estructura

```txt
src/
├── components/
│   ├── ui/          componentes reutilizables (Button, Modal, TablePanel, Badge…)
│   └── <dominio>/   componentes por área (auth, stock, users, warehouse, products, layout)
├── pages/           una carpeta por pantalla, con su .jsx y .css
├── services/        acceso a la API (normaliza snake_case del backend)
├── lib/             utilidades (apiClient, apiError, permissions, pagination…)
└── styles/
    └── variables.css   design tokens (colores, tipografía, espaciados)
docs/
├── credenciales.md  cuentas demo y variables sensibles
└── sprints/         documentación por sprint
```

---

## Flujo de trabajo Git

- `master` es producción. Solo recibe PRs desde `beta/*` o `hotfix/*` (lo valida el CI).
- `develop` es la rama de desarrollo. Todo el trabajo sale de ahí.

| Paso | Acción | Comando |
| --- | --- | --- |
| 1 | Actualizar `develop` | `git checkout develop` · `git pull origin develop` |
| 2 | Crear la rama de trabajo | `git checkout -b feature/nombre-feature` |
| 3 | Commitear | `git commit -m "ADDED: descripción"` |
| 4 | Subir la rama | `git push origin feature/nombre-feature` |
| 5 | Abrir el PR contra `develop` | Desde GitHub |

Ramas: `feature/…`, `fix/…`, `refactor/…`.

### Prefijos de commit

| Prefijo | Uso |
| --- | --- |
| `ADDED:` | Nueva funcionalidad |
| `FIX:` | Corrección de bug |
| `HOTFIX:` | Fix urgente aplicado directo en producción |
| `REFACTOR:` | Reorganización sin cambio de comportamiento (mover, renombrar, limpiar) |

---

## Despliegue

La app se despliega automáticamente en el servidor Warehouse-USAL vía
`wh-autodeploys` (runner self-hosted + Caddy). Se sirve bajo el prefijo
**`/app`** detrás del proxy; el backend queda en la raíz, por lo que las
llamadas a `/auth`, `/products`, etc. lo alcanzan sin configurar `BACKEND_URL`.

- Trabajo diario → PRs a `develop` (cualquier rama).
- Release → `beta/<versión>` o `hotfix/<versión>` a `master`, que publica la
  imagen a GHCR y dispara el deploy.
