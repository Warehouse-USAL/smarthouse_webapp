import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import TablePanel, { TablePanelTable } from "../../components/ui/TablePanel/TablePanel";
import Select from "../../components/ui/Select/Select";
import Badge from "../../components/ui/Badge/Badge";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import LoadError from "../../components/ui/LoadError/LoadError";
import ProgressBar from "../../components/ui/ProgressBar/ProgressBar";
import Pagination from "../../components/ui/Pagination/Pagination";
import { vehicleService } from "../../services/vehicleService";
import "./VehiclesPage.css";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "IDLE", label: "Disponible" },
  { value: "BUSY", label: "Ocupado" },
  { value: "OFFLINE", label: "Offline" },
  { value: "ERROR", label: "Mantenimiento" },
];

const STATUS_META = {
  IDLE: { label: "Disponible", variant: "success" },
  BUSY: { label: "Ocupado", variant: "warning" },
  OFFLINE: { label: "Offline", variant: "neutral" },
  ERROR: { label: "Mantenimiento", variant: "danger" },
};

const PAGE_SIZE = 10;

const formatLocation = (v) => {
  if (v.location) return v.location;
  if (typeof v.positionX === "number" && typeof v.positionY === "number") {
    return `X: ${v.positionX.toFixed(1)}, Y: ${v.positionY.toFixed(1)}`;
  }
  return "—";
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Solo se muestra la respuesta del último pedido (cambios rápidos de página o filtro).
  const lastRequest = useRef(0);

  // Paginación en el servidor: se pide solo la página visible con sus filtros.
  const fetchVehicles = useCallback(async () => {
    const requestId = ++lastRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await vehicleService.listPage({
        page,
        size: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      if (requestId !== lastRequest.current) return;
      setVehicles(result.items);
      setTotalPages(Math.max(1, result.totalPages));
      setTotalElements(result.totalElements);
    } catch (err) {
      if (requestId !== lastRequest.current) return;
      setError(err.response?.data?.error?.message || "No pudimos cargar los vehículos.");
    } finally {
      if (requestId === lastRequest.current) setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de la página contra el backend
    fetchVehicles();
  }, [fetchVehicles]);

  return (
    <div className="vehicles-page">
      <PageHeader
        title="Vehículos"
        subtitle="Visualizá el estado y la ubicación actual de los vehículos del warehouse."
      />

      <TablePanel
        title="Vehículos registrados"
        search={{
          placeholder: "Buscar vehículo",
          value: search,
          onChange: (e) => { setSearch(e.target.value); setPage(1); },
        }}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        filters={
          filtersOpen && (
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={STATUS_OPTIONS}
            />
          )
        }
        footer={
          !loading && !error && vehicles.length > 0 && (
            <>
              <span className="table-panel__showing">
                Mostrando {(page - 1) * PAGE_SIZE + 1} a{" "}
                {Math.min(page * PAGE_SIZE, totalElements)} de {totalElements} vehículos
              </span>
              <Pagination current={page} total={totalPages} onChange={setPage} />
            </>
          )
        }
      >
        {loading ? (
          <div className="table-panel__loading">
            <Spinner label="Cargando vehículos…" />
          </div>
        ) : error ? (
          <LoadError onRetry={fetchVehicles} />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon="truck"
            title="No hay vehículos"
            description="Cuando haya vehículos registrados, los verás listados acá."
          />
        ) : (
          <TablePanelTable>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Batería</th>
                <th>Ubicación actual</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => {
                const meta = STATUS_META[vehicle.status] || STATUS_META.OFFLINE;
                return (
                  <tr key={vehicle.id || vehicle.name}>
                    <td className="vehicles-table__name">{vehicle.name}</td>
                    <td>
                      <Badge variant={meta.variant} dot>{meta.label}</Badge>
                    </td>
                    <td>
                      <div className="vehicles-table__battery">
                        <span className="vehicles-table__battery-value">{vehicle.battery ?? 0}%</span>
                        <ProgressBar value={vehicle.battery ?? 0} />
                      </div>
                    </td>
                    <td>{formatLocation(vehicle)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TablePanelTable>
        )}
      </TablePanel>
    </div>
  );
}
