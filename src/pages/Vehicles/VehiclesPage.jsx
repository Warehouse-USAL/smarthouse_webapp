import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card from "../../components/ui/Card/Card";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import Button from "../../components/ui/Button/Button";
import Badge from "../../components/ui/Badge/Badge";
import Modal from "../../components/ui/Modal/Modal";
import Icon from "../../components/ui/Icon/Icon";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import ProgressBar from "../../components/ui/ProgressBar/ProgressBar";
import { vehicleService } from "../../services/vehicleService";
import { can } from "../../lib/permissions";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Registrar vehículo es solo de SUPERADMIN/ADMIN_SYSTEM; ADMIN_WAREHOUSE
  // entra a la pantalla (lectura) pero no puede dar de alta.
  const canCreate = can("vehicle.create");

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await vehicleService.list();
      setVehicles(list);
    } catch (err) {
      setError(err.response?.data?.error?.message || "No pudimos cargar los vehículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await vehicleService.list();
        if (!cancelled) setVehicles(list);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "No pudimos cargar los vehículos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false;
      if (search && !`${v.name}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [vehicles, search, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await vehicleService.register({ name: newName.trim() });
      setNewName("");
      setCreateOpen(false);
      await fetchVehicles();
    } catch (err) {
      alert(err.response?.data?.error?.message || "No pudimos registrar el vehículo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vehicles-page">
      <PageHeader
        title="Vehículos"
        subtitle="Visualizá el estado y la ubicación actual de los vehículos del warehouse."
        action={
          canCreate ? (
            <Button iconLeft={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
              Dar de alta vehículo
            </Button>
          ) : null
        }
      />

      <Card padding="md" className="vehicles-page__filters">
        <Input
          label="Buscar vehículo"
          placeholder="Buscar vehículo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={<Icon name="search" size={16} />}
        />
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_OPTIONS}
        />
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="vehicles-page__loading">
            <Spinner label="Cargando vehículos…" />
          </div>
        ) : error ? (
          <EmptyState
            icon="info"
            title="Algo salió mal"
            description={error}
            action={<Button variant="secondary" onClick={fetchVehicles}>Reintentar</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="truck"
            title="No hay vehículos"
            description="Cuando registres vehículos, los verás listados acá."
            action={
              canCreate ? (
                <Button iconLeft={<Icon name="plus" size={16} />} onClick={() => setCreateOpen(true)}>
                  Dar de alta vehículo
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="vehicles-table" role="table">
            <div className="vehicles-table__head" role="row">
              <span role="columnheader">Nombre</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Batería</span>
              <span role="columnheader">Ubicación actual</span>
              <span role="columnheader" className="vehicles-table__actions-head">Acciones</span>
            </div>
            {filtered.map((vehicle) => {
              const meta = STATUS_META[vehicle.status] || STATUS_META.OFFLINE;
              return (
                <div className="vehicles-table__row" role="row" key={vehicle.id || vehicle.name}>
                  <span role="cell" className="vehicles-table__name">{vehicle.name}</span>
                  <span role="cell">
                    <Badge variant={meta.variant} dot>{meta.label}</Badge>
                  </span>
                  <span role="cell" className="vehicles-table__battery">
                    <span className="vehicles-table__battery-value">{vehicle.battery ?? 0}%</span>
                    <ProgressBar value={vehicle.battery ?? 0} />
                  </span>
                  <span role="cell" className="vehicles-table__location">{formatLocation(vehicle)}</span>
                  <span role="cell" className="vehicles-table__actions">
                    <button className="vehicles-table__action" type="button">
                      Ver detalle
                      <Icon name="chevronRight" size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        title="Dar de alta vehículo"
        size="sm"
      >
        <form onSubmit={handleCreate} className="vehicles-page__create-form">
          <Input
            label="Nombre"
            placeholder="Ej. VEH-6"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <div className="vehicles-page__create-actions">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !newName.trim()}>
              {submitting ? "Guardando…" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
