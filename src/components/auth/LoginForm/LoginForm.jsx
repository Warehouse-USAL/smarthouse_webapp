import "./LoginForm.css";

export default function LoginForm({
  title,
  subtitle,
  topContent,
  subtitleClassName = "",
  children,
  onSubmit,
}) {
  return (
    <form className="login-form" onSubmit={onSubmit}>

      {topContent && (
        <div className="login-form-top-content">
          {topContent}
        </div>
      )}

      <h1>{title}</h1>

      <h3 className={subtitleClassName}>{subtitle}</h3>

      {children}

    </form>
  );
}