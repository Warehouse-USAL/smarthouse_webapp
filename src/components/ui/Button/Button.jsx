import "./Button.css";

export default function Button({
  children,

  variant = "primary",

  size = "md",

  disabled = false,

  type = "button",

  onClick,

  fullWidth = false,

  iconLeft,

  className = "",

  ...rest
}) {

  const classes = [
    "button",

    `button--${variant}`,

    `button--${size}`,

    fullWidth
      ? "button--full"
      : "",

    className,
  ]
    .filter(Boolean)
    .join(" ");



  return (
    <button
      className={classes}

      type={type}

      disabled={disabled}

      onClick={onClick}

      {...rest}
    >

      {iconLeft && (
        <span className="button__icon">
          {iconLeft}
        </span>
      )}

      <span>
        {children}
      </span>

    </button>
  );
}