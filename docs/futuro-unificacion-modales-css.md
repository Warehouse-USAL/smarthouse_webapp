# Futuro — Unificación de modales + Auditoría variables CSS

> Prioridad: BAJA | No entra en el sprint actual. Deuda técnica / mejora UX.
> Relacionado: `docs/sprint-gestion-ventas-stock.md` punto 6.

## 1. Objetivo
Un único formato de modal con variaciones (con/sin gráficos, distinto contenido) que unifique lo repetido. Hoy existe `src/components/ui/Modal/Modal.jsx` pero cada feature tiene su propio CSS y se ven distintos.

## 2. Estado actual
- Base: `Modal.jsx:4` (`open, onClose, title, children, footer, size=sm|md|lg`), backdrop `rgba(17,24,39,0.5)` hardcodeado en `Modal.css:4`.
- Modales con CSS propio: `RestockOrderModal`, `RemitoModal`, `LocateReceptionModal`, `ProductLocationModal`, `LocationAssignmentModal`, `ZonesEditModal`, `LinesEditModal`, `PositionsEditModal`, `UserFormModal`, `ResetPasswordModal`.

## 3. Propuesta (cuando se retome)
1. Extender `Modal` con `subtitle`, `variant`, `footerAlign`.
2. Crear en `src/components/ui/`: `ProductCard`, `InfoGrid`, `AlertBanner`, `ModalFooter`.
3. Migrar en orden: Restock → Acciones restock → Remito → Ventas detalle → resto.
4. Regla: prohibido CSS de modal fuera de `ui/Modal/`.

## 4. Auditoría variables CSS (`src/styles/variables.css`)
Variables definidas y que SE deben usar: `--color-primary, --color-text-primary/secondary/muted, --color-border/border-soft, --color-danger/success/warning (+-soft/-border), --color-link-blue, --radius-sm/md/lg/full, --shadow-card/soft/dropdown, --space-1/2/3/4/5/6/8/10`.

### Duplicadas / a consolidar
- Amarillos: `--color-yellow-primary #FBC400` vs `--color-yellow-primary-alt #FFC400`; `--color-yellow-dark #B77900` vs `-alt #A86B00`. Quedarse con uno.
- Bordes: `--color-border #d1d5db` = `--color-border-principal` = `--color-border-gray`. Eliminar 2.
- Grises texto: `--color-text-secondary #374151` vs `-alt #6B7280` vs `--color-grey` (alias). Documentar cuándo usar cada uno.
- Azules: `--color-link-blue #2563EB` = `--color-info-blue`; `--color-info-blue-soft #dbeafea9` (con alfa inconsistente). Unificar a `--color-info-*`.
- Radios: `--radius-lg 14px` = `--radius-cards 14px`; `--radius-soft 7px` casi = `--radius-sm 8px`. Consolidar.
- Fondos: `--color-surface #f5f6f8` vs `--color-surface-muted #f9fafb` vs `--color-bg-soft` (alias). Aclarar uso.
- Faltante: `--color-danger-muted` se usa en `CreateProductForm.css:147` con fallback `#fee2e2` pero NO existe en `variables.css`. Agregarla.
- Backdrop modal `rgba(17,24,39,0.5)` hardcodeado → crear `--color-overlay`.

### Hardcodeados a reemplazar (grep `src/components/**/*.css`)
- `LocationAssignmentModal.css:47 #f3f4f6` → `var(--color-surface-muted)` o nueva var.
- `ProductCard.css:43 rgba(0,0,0,0.72)` → `var(--color-overlay)` / `--shadow-*`.
- `ZoneGrid.css:72-80 rgba(245,158,11 / 34,197,94 / 59,130,246 / 139,92,246 ...)` → usar `--color-zone-a/b/c/d-*`.
- `Logo.css:17,26,89 rgba(0,0,0,0.12/0.18/0.14)` + `#050505` → vars sombra/texto.
- `Modal.css:4 rgba(17,24,39,0.5)` → `var(--color-overlay)`.
- Buscar también `px` literales de spacing/radius fuera de vars y `font-size/weight` literales → migrar a `typography.css` / vars.

## 5. Checklist cuando se active
- [ ] Consolidar vars duplicadas + agregar faltantes (`--color-overlay`, `--color-danger-muted`).
- [ ] Grep cero hex/rgba/px fuera de `variables.css` (salvo excepciones documentadas).
- [ ] Linter `stylelint` con regla `declaration-property-value-allowed-list` o script `grep` en CI.
- [ ] Migrar modales a base unificada.
- [ ] Capturas antes/después 1600/1366/768/375px.
