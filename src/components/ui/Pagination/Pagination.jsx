import Icon from "../Icon/Icon";
import "./Pagination.css";

const buildPages = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};

export default function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;
  const pages = buildPages(current, total);

  return (
    <div className="pagination">
      <button
        className="pagination__btn"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        aria-label="Página anterior"
      >
        <Icon name="chevronLeft" size={14} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="pagination__ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`pagination__page ${current === p ? "pagination__page--active" : ""}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="pagination__btn"
        disabled={current === total}
        onClick={() => onChange(current + 1)}
        aria-label="Página siguiente"
      >
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );
}
