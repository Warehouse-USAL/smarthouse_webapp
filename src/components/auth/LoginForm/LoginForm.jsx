import "./LoginForm.css";

export default function LoginForm({ title, subtitle, children, onSubmit }) {
  return (
    <form className="login-form" onSubmit={onSubmit}>
      <h1>{title}</h1>
      <h3>{subtitle}</h3>

      {children}
    </form>
  );
}