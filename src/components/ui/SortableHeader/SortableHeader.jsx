import Icon from "../Icon/Icon";
import "./SortableHeader.css";

/*
| Encabezado de tabla ordenable. `sort` es { field, dir: "asc" | "desc" } o null
| (orden por defecto). El ciclo de clics lo decide quien lo usa: acá solo se
| pinta el estado y se avisa qué columna se tocó.
*/
export default function SortableHeader({ label, field, sort, onSort }) {
  const dir = sort?.field === field ? sort.dir : null;
  return (
    <th aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <button
        type="button"
        className={`sortable-header ${dir ? "sortable-header--active" : ""}`.trim()}
        onClick={() => onSort(field)}
      >
        {label}
        <span className="sortable-header__arrows" aria-hidden="true">
          <Icon
            name="chevronUp"
            size={10}
            strokeWidth={3}
            className={dir === "asc" ? "sortable-header__arrow--on" : ""}
          />
          <Icon
            name="chevronDown"
            size={10}
            strokeWidth={3}
            className={dir === "desc" ? "sortable-header__arrow--on" : ""}
          />
        </span>
      </button>
    </th>
  );
}
