import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Select from "../../ui/Select/Select";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import { ROLE_OPTIONS, normalizeRole } from "../../../lib/userRoles";
import "./UserFormModal.css";

/*
|--------------------------------------------------------------------------
| USER FORM MODAL — alta y modificación de usuario
|--------------------------------------------------------------------------
|
| mode = "create"  → POST /users   { email, name, role, initial_password }
| mode = "edit"    → PATCH /users/:id { name?, role?, active? }
|
| En edición el email NO se puede modificar (el backend no expone ese campo en
| UpdateUserRequest), así que se muestra de solo lectura. El form sube SOLO los
| campos que cambiaron respecto del estado inicial → el PATCH se mantiene parcial.
|
*/

const buildInitialState = (mode, user) => ({
  email: user?.email ?? "",
  name: user?.name ?? "",
  role: normalizeRole(user?.role) || "",
  active: user?.active ?? true,
  initialPassword: "",
});

export default function UserFormModal({
  open,
  mode = "create",
  user = null,
  onClose,
  onSubmit,
  submitting = false,
  error = null,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => buildInitialState(mode, user));
  const [errors, setErrors] = useState({});

  // Reinicia el form cada vez que se abre / cambia el usuario objetivo.
  // Sincroniza el estado del form con las props del modal al abrirlo: es el caso
  // legítimo de "resetear al abrir", no el cascade que la regla previene.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(buildInitialState(mode, user));
      setErrors({});
    }
  }, [open, mode, user]);

  const set = (key) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const validate = () => {
    const errs = {};
    if (!values.name.trim()) errs.name = "El nombre es obligatorio";
    if (!values.role) errs.role = "Elegí un rol";
    if (!isEdit) {
      if (!values.email.trim()) errs.email = "El email es obligatorio";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
        errs.email = "Email inválido";
      if (!values.initialPassword) errs.initialPassword = "La contraseña inicial es obligatoria";
      else if (values.initialPassword.length < 4)
        errs.initialPassword = "Mínimo 4 caracteres";
    }
    return errs;
  };

  // En edición: solo los campos que cambiaron → PATCH parcial real.
  const changedPayload = useMemo(() => {
    if (!isEdit) return null;
    const patch = {};
    if (values.name.trim() !== (user?.name ?? "")) patch.name = values.name.trim();
    if (values.role !== normalizeRole(user?.role)) patch.role = values.role;
    if (values.active !== (user?.active ?? true)) patch.active = values.active;
    return patch;
  }, [isEdit, values, user]);

  const nothingChanged = isEdit && changedPayload && Object.keys(changedPayload).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (isEdit) {
      onSubmit(changedPayload);
    } else {
      onSubmit({
        email: values.email.trim(),
        name: values.name.trim(),
        role: values.role,
        initialPassword: values.initialPassword,
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={isEdit ? "Modificar usuario" : "Nuevo usuario"}
      footer={
        <div className="user-form__footer">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="user-form"
            disabled={submitting || nothingChanged}
          >
            {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      }
    >
      <form id="user-form" className="user-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="user-form__alert" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Email"
          name="email"
          type="email"
          value={values.email}
          onChange={set("email")}
          placeholder="persona@empresa.com"
          required={!isEdit}
          disabled={isEdit}
          error={errors.email}
          hint={isEdit ? "El email no puede modificarse" : undefined}
        />

        <Input
          label="Nombre completo"
          name="name"
          value={values.name}
          onChange={set("name")}
          placeholder="Nombre y apellido"
          required
          error={errors.name}
        />

        <Select
          label="Rol"
          name="role"
          value={values.role}
          onChange={set("role")}
          options={ROLE_OPTIONS}
          placeholder="Seleccioná un rol"
          required
          error={errors.role}
        />

        {!isEdit && (
          <Input
            label="Contraseña inicial"
            name="initialPassword"
            type="password"
            value={values.initialPassword}
            onChange={set("initialPassword")}
            placeholder="Mínimo 4 caracteres"
            required
            error={errors.initialPassword}
            hint="El usuario podrá cambiarla luego desde su perfil"
          />
        )}

        {isEdit && (
          <label className="user-form__toggle">
            <span className="user-form__toggle-text">
              <span className="user-form__toggle-title">Usuario activo</span>
              <span className="user-form__toggle-sub">
                {values.active
                  ? "Puede iniciar sesión y operar"
                  : "El acceso queda deshabilitado"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={values.active}
              onChange={set("active")}
              className="user-form__toggle-input"
            />
            <span className="user-form__toggle-track" aria-hidden="true">
              <span className="user-form__toggle-thumb" />
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}
