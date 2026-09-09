# Testing — Jest

Guía de referencia sobre los tests del proyecto: qué hacen, dónde viven y cómo usarlos.

---

## Qué es

La app usa **Jest** como runner de tests. Jest busca y ejecuta cualquier archivo nombrado
`*.test.js` o `*.test.jsx` (también acepta `.spec.*`), los corre en un entorno de navegador
simulado (**jsdom**) y reporta en la terminal cuáles pasan y cuáles fallan.

> Nota: hoy está configurado Jest solo (unit tests de lógica pura). React Testing Library
> se suma en una etapa posterior para testear componentes.

---

## Requisitos

- Node.js ≥ 18.
- Dependencias ya declaradas en `package.json` (`devDependencies`):
  `jest`, `jest-environment-jsdom`, `babel-jest`, `@babel/core`, `@babel/preset-env`, `@babel/preset-react`.

Instalar/reinstalar desde cero:

```bash
npm install
```

---

## Cómo se usa

| Comando | Qué hace |
|---|---|
| `npm test` | Corre **todos** los tests una vez y termina. Es el modo "verificar todo". |
| `npm test:watch` | Entra en modo watch: re-ejecuta los tests afectados cada vez que guardás un archivo. Ideal mientras desarrollás. |

Ejemplo de salida de `npm test`:

```
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        1.5 s
Ran all test suites.
```

Si algo falla, Jest imprime qué suite, qué test y en qué `expect` falló
(incluye diff cuando compara valores).

---

## Cuándo se ejecutan

- **Solo de forma manual** con los comandos de arriba.
- **No** se ejecutan con `npm run dev` ni con `npm run build`:
  los tests no forman parte del bundle ni del servidor de desarrollo.
- Correrlos es seguro: no modifican datos ni tocan el backend.

---

## Dónde van los tests

Cada test vive **al lado del archivo que prueba**, con el sufijo `.test.js` / `.test.jsx`:

```
src/lib/storageCompatibility.js          ← código
src/lib/storageCompatibility.test.js     ← su test
```

Jest los descubre automáticamente por el nombre: no hay que registrarlos en ningún lado.

---

## Qué hace cada pieza de configuración

| Archivo | Rol |
|---|---|
| `jest.config.cjs` | Configuración de Jest: entorno `jsdom`, transformación con `babel-jest`, patrón `*.test.{js,jsx}`, y mapeo de `*.css` → stub. |
| `babel.config.cjs` | Transforma JS/SX: preset-env (Node actual) + preset-react con runtime automático (igual que Vite). |
| `src/test/styleMock.cjs` | Stub vacío para los `import "./x.css"`: evita que Jest falle al importar componentes con CSS y no pide CSS de verdad. |
| `package.json` | Scripts `test` y `test:watch`. |
| `eslint.config.js` | Permite los globals de Jest (`describe`, `it`, `expect`, …) en archivos `*.test.{js,jsx}` sin tirones de lint. |

> Los archivos `.cjs` son CommonJS a propósito: evitan roces entre Jest/Babel y el
> `"type": "module"` del proyecto.

---

## Cómo escribir un test

```js
import { isCompatible } from "./storageCompatibility.js";

describe("isCompatible", () => {
  it("retorna true cuando unidad y tamaño matchean", () => {
    expect(isCompatible("PEQUEÑA", "CAJA")).toBe(true);
  });

  it("retorna false cuando no matchean", () => {
    expect(isCompatible("GRANDE", "CAJA")).toBe(false);
  });
});
```

Convenciones:

- Un `describe` por unidad/componente y un `it` (o `test`) por comportamiento.
- **Los servicios que hablan con el backend se mockean** (`jest.mock(...)` al testear
  componentes/conexiones), porque arrancan con `import.meta.env.VITE_USE_MOCK` y no deben
  golpear la red ni el proxy de Vite.
- Nombrar los tests con el comportamiento, no con la implementación
  (ej. "retorna false cuando no matchean", no "llama a la función X").

---

## Test de ejemplo incluido

`src/lib/storageCompatibility.test.js` cubre la regla del Hito 2 (§4.3.2):
compatibilidad entre tamaño de posición y unidad de almacenamiento, y cuántas unidades
entran por volumen. Además sirve como "smoke test": si `npm test` pasa, el pipeline
completo de Jest está funcionando.