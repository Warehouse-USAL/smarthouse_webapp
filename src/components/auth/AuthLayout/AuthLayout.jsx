import "./AuthLayout.css";

export default function AuthLayout({
  leftContent,
  rightContent,
}) {
  return (
    <div className="container_login">
      <div className="left_login">
        {leftContent}
      </div>

      <div className="right_login">
        {rightContent}
      </div>
    </div>
  );
}