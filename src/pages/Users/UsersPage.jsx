import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Button from "../../components/ui/Button/Button";
import Input from "../../components/ui/Input/Input";
import Select from "../../components/ui/Select/Select";
import Icon from "../../components/ui/Icon/Icon";
import Card from "../../components/ui/Card/Card";
import Badge from "../../components/ui/Badge/Badge";
import Spinner from "../../components/ui/Spinner/Spinner";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import Pagination from "../../components/ui/Pagination/Pagination";
import UserFormModal from "../../components/users/UserFormModal/UserFormModal";
import ResetPasswordModal from "../../components/users/ResetPasswordModal/ResetPasswordModal";
import { userService } from "../../services/userService";
import { ROLE_OPTIONS, roleLabel, roleVariant } from "../../lib/userRoles";
import "./UsersPage.css";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

const PAGE_SIZE = 10;

// Traducción de los códigos de error del backend (UserController / UserService).
const ERROR_MESSAGES = {
  EMAIL_ALREADY_EXISTS: "Ya existe un usuario con ese email.",
  USER_NOT_FOUND: "El usuario ya no existe.",
  INVALID_ROLE: "El rol seleccionado no es válido.",
  WRONG_CURRENT_PASSWORD: "La contraseña actual es incorrecta.",
  SAME_PASSWORD: "La nueva contraseña debe ser distinta a la anterior.",
};

const errorMessage = (err, fallback) => {
  const code = err?.response?.data?.error?.code ?? err?.response?.data?.message ?? err?.message;
  return ERROR_MESSAGES[code] || fallback;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [page, setPage] = useState(1); // UI: 1-indexed; backend: 0-indexed

  // Modales
  const [formMode, setFormMode] = useState(null); // "create" | "edit" | null
  const [activeUser, setActiveUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: list, pagination } = await userService.list({
        role: roleFilter || undefined,
        isActive: statusFilter !== "" ? statusFilter : undefined,
        page: page - 1,
        size: PAGE_SIZE,
      });
      setUsers(list);
      setTotalPages(Math.max(1, pagination.totalPages));
      setTotalElements(pagination.totalElements);
    } catch (err) {
      setError(errorMessage(err, "No pudimos cargar los usuarios."));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, page]);

  useEffect(() => {
    // fetchUsers setea loading/error de forma síncrona para manejar la UI de
    // carga (montaje + cambio de filtros/página); es intencional, no el cascade
    // derivado de render que esta regla previene.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  // Filtro rápido (nombre/email) sobre la página cargada — el backend no expone
  // búsqueda de texto en /users, así que es un filtro local de la página actual.
  const visibleUsers = useMemo(() => {
    const q = quickFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, quickFilter]);

  const openCreate = () => {
    setActiveUser(null);
    setFormError(null);
    setFormMode("create");
  };

  const openEdit = (user) => {
    setActiveUser(user);
    setFormError(null);
    setFormMode("edit");
  };

  const closeForm = () => {
    if (submitting) return;
    setFormMode(null);
    setActiveUser(null);
    setFormError(null);
  };

  const handleSubmitForm = async (payload) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await userService.create(payload);
      } else if (activeUser) {
        await userService.update(activeUser.id, payload);
      }
      setFormMode(null);
      setActiveUser(null);
      await fetchUsers();
    } catch (err) {
      setFormError(
        errorMessage(
          err,
          formMode === "create"
            ? "No pudimos crear el usuario."
            : "No pudimos guardar los cambios."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (newPassword) => {
    if (!resetUser) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await userService.resetPassword(resetUser.id, newPassword);
      setResetUser(null);
    } catch (err) {
      setFormError(errorMessage(err, "No pudimos restablecer la contraseña."));
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setRoleFilter("");
    setStatusFilter("");
    setQuickFilter("");
    setPage(1);
  };

  return (
    <div className="users-page">
      <PageHeader
        title="Usuarios"
        subtitle="Gestioná las cuentas del sistema: alta, modificación de rol y estado, y restablecimiento de contraseña."
        action={
          <Button iconLeft={<Icon name="plus" size={16} />} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      <Card padding="md" className="users-page__filters">
        <div className="users-page__filter users-page__filter--grow">
          <Input
            placeholder="Filtrar por nombre o email (en esta página)"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            iconLeft={<Icon name="search" size={16} />}
          />
        </div>
        <div className="users-page__filter">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            options={[{ value: "", label: "Todos los roles" }, ...ROLE_OPTIONS]}
          />
        </div>
        <div className="users-page__filter">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </Card>

      {loading ? (
        <div className="users-page__loading">
          <Spinner label="Cargando usuarios…" />
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            icon="info"
            title="Algo salió mal"
            description={error}
            action={
              <Button variant="secondary" onClick={fetchUsers}>
                Reintentar
              </Button>
            }
          />
        </Card>
      ) : visibleUsers.length === 0 ? (
        <Card>
          <EmptyState
            icon="user"
            title="No hay usuarios"
            description={
              quickFilter || roleFilter || statusFilter
                ? "No encontramos usuarios con los filtros seleccionados."
                : "Todavía no hay usuarios cargados."
            }
            action={
              quickFilter || roleFilter || statusFilter ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button iconLeft={<Icon name="plus" size={16} />} onClick={openCreate}>
                  Nuevo usuario
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="users-page__table-card">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Alta</th>
                  <th className="users-table__actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-table__user">
                        <span className="users-table__avatar" aria-hidden="true">
                          {initials(user.name)}
                        </span>
                        <div className="users-table__user-text">
                          <span className="users-table__name">{user.name}</span>
                          <span className="users-table__email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
                    </td>
                    <td>
                      <Badge variant={user.active ? "success" : "neutral"} dot>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="users-table__date">{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="users-table__actions">
                        <button
                          type="button"
                          className="users-table__action"
                          onClick={() => openEdit(user)}
                          title="Modificar usuario"
                        >
                          <Icon name="edit" size={16} />
                          <span>Modificar</span>
                        </button>
                        <button
                          type="button"
                          className="users-table__action"
                          onClick={() => {
                            setFormError(null);
                            setResetUser(user);
                          }}
                          title="Restablecer contraseña"
                        >
                          <Icon name="alert" size={16} />
                          <span>Contraseña</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && !error && totalElements > 0 && (
        <footer className="users-page__footer">
          <span className="users-page__count">
            {totalElements} usuario{totalElements === 1 ? "" : "s"} en total
            {quickFilter && ` · ${visibleUsers.length} en esta página`}
          </span>
          <Pagination current={page} total={totalPages} onChange={setPage} />
        </footer>
      )}

      <UserFormModal
        open={formMode !== null}
        mode={formMode || "create"}
        user={activeUser}
        submitting={submitting}
        error={formError}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <ResetPasswordModal
        open={resetUser !== null}
        user={resetUser}
        submitting={submitting}
        error={formError}
        onClose={() => !submitting && setResetUser(null)}
        onSubmit={handleResetPassword}
      />
    </div>
  );
}
