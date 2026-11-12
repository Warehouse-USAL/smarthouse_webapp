import { useCallback, useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import Avatar from "../../ui/Avatar/Avatar";
import Badge from "../../ui/Badge/Badge";
import Spinner from "../../ui/Spinner/Spinner";
import LoadError from "../../ui/LoadError/LoadError";
import StatusBanner from "../../ui/StatusBanner/StatusBanner";
import { userService } from "../../../services/userService";
import { updateStoredUser } from "../../../services/authService";
import { errorText } from "../../../lib/apiError";
import { normalizeRole, roleLabel, roleVariant } from "../../../lib/userRoles";
import "./ProfileModal.css";

/*
|--------------------------------------------------------------------------
| MI PERFIL — datos propios del usuario logueado (cualquier rol)
|--------------------------------------------------------------------------
|
|   lectura   userService.getMe       (PATCH /users/me vacío, hasta que exista
|                                      GET /users/me: docs/nuevos_requisitos.md)
|   datos     PATCH /users/me         { name, address }
|   clave     POST /users/me/change-password { current_password, new_password }
|
| Email y rol no los puede cambiar uno mismo (no hay endpoint): van de solo
| lectura. El proveedor de un PROVIDER lo asigna un administrador.
*/

const EMPTY_ADDRESS = { street: "", department: "", floor: "", postalCode: "" };
const EMPTY_PASSWORDS = { current: "", next: "", repeat: "" };

const PASSWORD_ERRORS = {
  WRONG_CURRENT_PASSWORD: "La contraseña actual no es correcta.",
  SAME_PASSWORD: "La nueva contraseña tiene que ser distinta de la actual.",
};

const sameAddress = (a, b) =>
  Object.keys(EMPTY_ADDRESS).every((key) => (a?.[key] ?? "") === (b?.[key] ?? ""));

export default function ProfileModal({ open, onClose }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [dataSaving, setDataSaving] = useState(false);
  const [dataStatus, setDataStatus] = useState(null);

  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  const fillForm = (user) => {
    setMe(user);
    setName(user.name ?? "");
    setAddress(user.address ?? EMPTY_ADDRESS);
  };

  // Cada apertura arranca limpia: sin avisos previos ni contraseñas tipeadas.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setDataStatus(null);
    setPasswords(EMPTY_PASSWORDS);
    setPasswordStatus(null);
    try {
      fillForm(await userService.getMe());
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir
    load();
  }, [open, load]);

  const nameError = name.trim() ? null : "Ingresá tu nombre.";
  const dataChanged =
    me && (name.trim() !== (me.name ?? "") || !sameAddress(address, me.address));

  const handleSaveData = async () => {
    if (nameError || !dataChanged) return;
    setDataSaving(true);
    setDataStatus(null);
    try {
      // `address` reemplaza la dirección entera: se manda solo si cambió.
      const updated = await userService.updateMe({
        name: name.trim(),
        ...(sameAddress(address, me.address) ? {} : { address }),
      });
      fillForm(updated);
      updateStoredUser({ name: updated.name });
      setDataStatus({ ok: true, text: "Datos actualizados." });
    } catch (e) {
      setDataStatus({ ok: false, text: errorText(e, {}, "No pudimos guardar tus datos.") });
    } finally {
      setDataSaving(false);
    }
  };

  const passwordError =
    passwords.repeat && passwords.next !== passwords.repeat
      ? "Las contraseñas no coinciden."
      : null;
  const canChangePassword =
    passwords.current && passwords.next && passwords.repeat && !passwordError;

  const handleChangePassword = async () => {
    if (!canChangePassword) return;
    setPasswordSaving(true);
    setPasswordStatus(null);
    try {
      await userService.changeMyPassword(passwords.current, passwords.next);
      setPasswords(EMPTY_PASSWORDS);
      setPasswordStatus({ ok: true, text: "Contraseña actualizada." });
    } catch (e) {
      setPasswordStatus({
        ok: false,
        text: errorText(e, PASSWORD_ERRORS, "No pudimos cambiar la contraseña."),
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const setAddressField = (field) => (e) =>
    setAddress((prev) => ({ ...prev, [field]: e.target.value }));
  const setPasswordField = (field) => (e) =>
    setPasswords((prev) => ({ ...prev, [field]: e.target.value }));

  const isProvider = normalizeRole(me?.role) === "PROVIDER";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mi perfil"
      subtitle="Tus datos de usuario y tu contraseña."
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {loading ? (
        <div className="profile-modal__loading">
          <Spinner label="Cargando perfil…" />
        </div>
      ) : loadError ? (
        <LoadError onRetry={load} />
      ) : (
        me && (
          <div className="profile-modal">
            <div className="profile-modal__header">
              <Avatar name={me.name} size={48} />
              <div className="profile-modal__identity">
                <span className="profile-modal__name">{me.name}</span>
                <span className="profile-modal__email">{me.email}</span>
                <span className="profile-modal__badges">
                  <Badge variant={roleVariant(me.role)} dot>
                    {roleLabel(me.role)}
                  </Badge>
                  {isProvider && (
                    <span className="profile-modal__supplier">
                      {me.supplier
                        ? `Proveedor: ${me.supplier}`
                        : "Sin proveedor asignado: pedíselo a un administrador."}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <section className="profile-modal__section">
              <h4 className="profile-modal__section-title">Datos personales</h4>
              <Input
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={nameError}
                required
              />
              <div className="profile-modal__grid">
                <Input label="Calle y número" value={address.street} onChange={setAddressField("street")} />
                <Input label="Departamento" value={address.department} onChange={setAddressField("department")} />
                <Input label="Piso" value={address.floor} onChange={setAddressField("floor")} />
                <Input label="Código postal" value={address.postalCode} onChange={setAddressField("postalCode")} />
              </div>
              {dataStatus && (
                <StatusBanner
                  statusBannerState={dataStatus.ok ? "status-banner-exito" : "status-banner-error"}
                  icon={<Icon name={dataStatus.ok ? "check" : "alert"} size={16} />}
                  text={dataStatus.text}
                />
              )}
              <div className="profile-modal__actions">
                <Button
                  onClick={handleSaveData}
                  disabled={dataSaving || !!nameError || !dataChanged}
                >
                  {dataSaving ? "Guardando…" : "Guardar datos"}
                </Button>
              </div>
            </section>

            <section className="profile-modal__section">
              <h4 className="profile-modal__section-title">Cambiar contraseña</h4>
              <Input
                label="Contraseña actual"
                type="password"
                value={passwords.current}
                onChange={setPasswordField("current")}
              />
              <div className="profile-modal__grid">
                <Input
                  label="Nueva contraseña"
                  type="password"
                  value={passwords.next}
                  onChange={setPasswordField("next")}
                />
                <Input
                  label="Repetir nueva contraseña"
                  type="password"
                  value={passwords.repeat}
                  onChange={setPasswordField("repeat")}
                  error={passwordError}
                />
              </div>
              {passwordStatus && (
                <StatusBanner
                  statusBannerState={passwordStatus.ok ? "status-banner-exito" : "status-banner-error"}
                  icon={<Icon name={passwordStatus.ok ? "check" : "alert"} size={16} />}
                  text={passwordStatus.text}
                />
              )}
              <div className="profile-modal__actions">
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !canChangePassword}
                >
                  {passwordSaving ? "Guardando…" : "Cambiar contraseña"}
                </Button>
              </div>
            </section>
          </div>
        )
      )}
    </Modal>
  );
}
