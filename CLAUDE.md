@AGENTS.md

# CLAUDE.md — SmartWarehouse Web App

Notas de trabajo para Claude. Las reglas generales (simplicidad, cambios
quirúrgicos, camelCase, design tokens, sin emojis, nombres de commit) están en
`AGENTS.md` y tienen prioridad.

## Stack

- React 19 + Vite 8 + React Router 7 + Axios. Tests con Vitest (`*.test.js`
  junto al archivo que prueban).
- Backend: `wh-backend` en `:8080`, alcanzado vía proxy de Vite
  (`vite.config.js`). Swagger: `http://localhost:8080/swagger-ui/index.html#/`
  (fuente de verdad del contrato).
- Sin mocks: los services siempre van contra el backend. Los errores suben a
  las páginas, que los muestran con `src/lib/apiError.js`.

## Comandos

```bash
npm run dev     # http://localhost:5173
npm run lint
npm test        # vitest run
npm run build
```

Antes de dar una tarea por terminada: lint, tests y build en verde (son los
jobs del CI en `.github/workflows/ci.yml`).

## Estructura

- `src/components/ui/` — componentes reutilizables (Button, Modal, TablePanel,
  ActionCard, Badge, Pagination, etc.). Revisar acá antes de crear uno nuevo.
- `src/components/<dominio>/` — componentes por dominio (auth, stock, users,
  warehouse, products, layout).
- `src/pages/` — una carpeta por pantalla con su `.jsx` y `.css`.
- `src/services/` — acceso a la API (normalizan snake_case del backend).
- `src/lib/` — utilidades (apiClient, apiError, permissions, pagination…).
- `src/styles/variables.css` — design tokens (colores, `--text-*`, espaciados).

## Git

- Ramas de trabajo desde `develop` (`feature/…`, `fix/…`, `refactor/…`); PR a
  `develop`.
- `master` solo recibe `beta/*` o `hotfix/*` (lo valida el CI) y dispara el
  deploy (servido bajo `/app`).
- Rama actual de cierre: `feature/toques-finales`.

## Pendientes conocidos

- Tokens de `padding` y `margin`.
- Sugerencias de restock: manejo de `[]` vs `null` en `listAlerts` /
  `StockManagementPage` y regla de negocio cuando no hay demanda.

## Notas

- Íconos: `src/assets/icons/` y `src/components/ui/Icon/`.
