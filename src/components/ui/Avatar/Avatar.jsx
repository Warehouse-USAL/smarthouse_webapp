import "./Avatar.css";

export default function Avatar({ name, src, size = 32, className = "" }) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Avatar"}
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`avatar avatar--placeholder ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials || (
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </div>
  );
}
