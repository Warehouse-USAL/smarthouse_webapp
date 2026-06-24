import { useEffect, useState } from "react";
import Modal from "../../ui/Modal/Modal";
import Input from "../../ui/Input/Input";
import Button from "../../ui/Button/Button";
import Icon from "../../ui/Icon/Icon";
import "./ResetPasswordModal.css";

/*
|--------------------------------------------------------------------------
| RESET PASSWORD MODAL — reset administrativo
|--------------------------------------------------------------------------
|
| POST /users/:id/reset-password  { new_password }  → 204
| No pide la contraseña anterior (es un reset de admin, no el self-service
| change-password). Solo validamos longitud mínima y confirmación en el front.
|
*/

export default function ResetPasswordModal({
  open,
  user = null,
  onClose,
  onSubmit,
  submitting = false,
  error = null,
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  // Limpia los campos cada vez que se abre el modal (reset legítimo al abrir).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword("");
      setConfirm("");
      setLocalError("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.length < 4) {
      setLocalError("La contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (password !== confirm) {
      setLocalError("Las contraseñas no coinciden");
      return;
    }
    setLocalError("");
    onSubmit(password);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Restablecer contraseña"
      footer={
        <div className="reset-password__footer">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="reset-password-form" variant="danger" disabled={submitting}>
            {submitting ? "Restableciendo…" : "Restablecer"}
          </Button>
        </div>
      }
    >
      <form id="reset-password-form" className="reset-password" onSubmit={handleSubmit} noValidate>
        {user && (
          <p className="reset-password__intro">
            Vas a definir una nueva contraseña para{" "}
            <strong>{user.name}</strong> ({user.email}). El usuario deberá usarla en su
            próximo inicio de sesión.
          </p>
        )}

        {(error || localError) && (
          <div className="reset-password__alert" role="alert">
            <Icon name="alert" size={16} />
            <span>{error || localError}</span>
          </div>
        )}

        <Input
          label="Nueva contraseña"
          name="new_password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 4 caracteres"
          required
        />
        <Input
          label="Repetir contraseña"
          name="confirm_password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Volvé a escribirla"
          required
        />
      </form>
    </Modal>
  );
}
