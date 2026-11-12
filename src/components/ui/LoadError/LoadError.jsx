import EmptyState from "../EmptyState/EmptyState";
import Button from "../Button/Button";

// Estado de "no se pudieron cargar los datos", para mostrar en el lugar de la
// tabla o lista que no cargó. `description` reemplaza el texto genérico cuando
// el motivo es otro (p. ej. un límite del filtro).
export default function LoadError({
  description = "Puede ser un problema de conexión. Revisá tu internet e intentá de nuevo en unos segundos.",
  onRetry,
}) {
  return (
    <EmptyState
      icon="wifiOff"
      title="No pudimos cargar la información"
      description={description}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null
      }
    />
  );
}
