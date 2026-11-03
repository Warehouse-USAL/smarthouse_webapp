# Sprint siguiente — Deuda de endpoints, visual y mobile

> Estado: planificado. Arranca una vez aprobado y mergeado el PR de
> `feature/adaptar-backend-aditivo` a `develop`.
> Base: `develop` actualizado. Rama sugerida: `feature/sprint-endpoints-visual-mobile`.
> Fecha: 2026-11-03

---

## Objetivo

Cerrar la deuda que quedó entre los endpoints/campos nuevos del backend y lo que
la UI muestra, ordenar las mejoras visuales pendientes y dejar la webapp usable
en mobile. No se modifica el backend salvo que se detecte un faltante y se
acuerde con el equipo de back.

---

## a) Deuda de endpoints nuevos (modificación de stock) — prioridad alta

**Problema:** el backend ya resuelve la modificación de stock (ajuste con
`reason`, cancelación de órdenes en la misma transacción vía
`cancelled_orders`, estado `CANCELLED` en restock), pero la UI todavía no le da
visibilidad completa a esa información.

**Tareas:**

- [ ] Confirmar el contrato exacto de los endpoints y campos nuevos antes de
      consumirlos. La fuente de verdad es el swagger del backend:
      `http://localhost:8080/swagger-ui/index.html#/`.
- [ ] Mostrar la **auditoría del ajuste de stock**: motivo, usuario y fecha
      (hoy el front envía `reason` pero no lo vuelve a leer ni lo muestra).
- [ ] Consumir y mostrar el **historial de movimientos / kardex por producto**
      cuando el backend lo exponga. Si no existe endpoint, documentarlo como
      bloqueante y no simular datos.
- [ ] Mostrar en el detalle las **órdenes canceladas por reducción de stock**
      (`cancelled_orders`) con su motivo y código, de forma consistente con el
      modal actual de reducción.
- [ ] Revisar que no queden llamadas a contratos viejos: el fallback a backend
      viejo debe quedar solo como compatibilidad, no como camino principal.
- [ ] Actualizar el texto de fallback de cancelación de restock en
      `StockManagementPage.jsx` (hoy dice que el backend no lo soporta).
- [ ] Dejar documentado el contrato consumido en `docs/`.

**Criterio de aceptación:** hacer un ajuste de stock con motivo y poder ver,
desde la UI, el motivo, el usuario y la fecha; al reducir por debajo de la
reserva, ver las órdenes canceladas por el backend con su motivo. Sin datos
inventados: si falta un endpoint, se marca como pendiente de backend.

---

## b) Mejoras visuales — prioridad media

**Problema:** quedaron mejoras de UI/UX pendientes del sprint anterior y otras
que surjan de la revisión de negocio.

**A definir con negocio/UX** (lista preliminar a confirmar):

- [ ] Unificar los modales restantes al patrón `Modal` compartido (`RemitoModal`,
      `LocateReceptionModal`, modales de warehouse/usuarios).
- [ ] Datos de stock en la ficha de producto: disponible, reserva, físico real y
      badge de "Reponer".
- [ ] Columna "Ya pedido" / "(+N en camino)" usando `onOrderStock`.
- [ ] Preview automático de cantidad sugerida en la nueva orden de restock.
- [ ] Capturas pixel-perfect pendientes de las pantallas de Stock y Productos
      (1600 / 1366 / 768 / 375 px).
- [ ] Consistencia de design tokens, espaciados y tipografía.

**Criterio de aceptación:** cada mejora acordada queda implementada sin cambiar
comportamiento funcional y con captura antes/después.

---

## c) Mobile — prioridad baja

**Problema:** la app está pensada para desktop; en mobile puede romperse o
desbordar.

**Tareas:**

- [ ] Revisar todas las pantallas en 375 px y 768 px.
- [ ] Tablas: scroll horizontal controlado o apilado de filas; evitar desbordes
      del contenedor.
- [ ] Navegación (navbar/menú) usable en mobile.
- [ ] Modales: ancho, padding y scroll interno correctos.
- [ ] Formularios: inputs y botones a ancho completo cuando corresponda.
- [ ] Verificar que no haya scroll horizontal global.

**Criterio de aceptación:** ninguna pantalla se rompe ni genera scroll
horizontal en 375 px y 768 px; las acciones principales siguen accesibles.

---

## Orden sugerido

1. **a)** Deuda de endpoints de stock (alto impacto funcional).
2. **b)** Mejoras visuales acordadas con negocio.
3. **c)** Mobile (baja prioridad, al final).

---

## Fuera de alcance / pendientes heredados

- **Kardex**: si el backend no expone el endpoint, queda bloqueado.
- **Despacho manual de ventas**: depende de la decisión del backend.
- **Nombre de cliente en `Order`**: requiere `admin_system` o un join del
  backend.
