import Card from "../Card/Card";
import Input from "../Input/Input";
import Icon from "../Icon/Icon";
import "./TablePanel.css";

export default function TablePanel({
  title,
  count,
  hint,
  description,
  search,
  filtersOpen = false,
  onToggleFilters,
  filters,
  filtersClassName = "",
  footer,
  className = "",
  children,
}) {
  const hasHead = Boolean(title || description);
  const showFiltersButton = typeof onToggleFilters === "function";

  return (
    <Card padding="none" className={`table-panel ${className}`.trim()}>
      {hasHead && (
        <header className="table-panel__head">
          {title && (
            <h3 className="table-panel__title">
              {title}
              {count != null && <span className="table-panel__count">{count}</span>}
              {hint && (
                <span className="table-panel__hint" title={hint}>
                  <Icon name="info" size={15} />
                </span>
              )}
            </h3>
          )}
          {description && <p className="table-panel__desc">{description}</p>}
        </header>
      )}

      {(search || showFiltersButton) && (
        <div className="table-panel__toolbar">
          {search && (
            <Input
              placeholder={search.placeholder}
              value={search.value}
              onChange={search.onChange}
              iconLeft={<Icon name="search" size={16} />}
            />
          )}
          {showFiltersButton && (
            <button
              type="button"
              className={`table-panel__filters-btn ${
                filtersOpen ? "table-panel__filters-btn--on" : ""
              }`}
              onClick={onToggleFilters}
            >
              <Icon name="filter" size={16} />
              Filtros
            </button>
          )}
        </div>
      )}

      {filters && (
        <div className={`table-panel__filters ${filtersClassName}`.trim()}>
          {filters}
        </div>
      )}

      {children}

      {footer && <footer className="table-panel__foot">{footer}</footer>}
    </Card>
  );
}

export function TablePanelTable({ className = "", wrapClassName = "", children }) {
  return (
    <div className={`table-panel__table-wrap ${wrapClassName}`.trim()}>
      <table className={`table-panel__table ${className}`.trim()}>
        {children}
      </table>
    </div>
  );
}
