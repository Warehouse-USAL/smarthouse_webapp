import Icon from "../Icon/Icon";
import "./ActionCard.css";

export default function ActionCard({
  icon,
  title,
  description,
  note,
  variant = "yellow",
  onClick,
}) {
  return (
    <button
      type="button"
      className={`action-card action-card--${variant}`}
      onClick={onClick}
    >
      <div className="action-card__icon">
        <Icon name={icon} size={22} color="currentColor" />
      </div>
      <div className="action-card__body">
        <h3 className="action-card__title">{title}</h3>
        <p className="action-card__desc">
          {description}
          {note && (
            <>
              <br />
              {note}
            </>
          )}
        </p>
      </div>
      <Icon name="chevronRight" size={18} className="action-card__chevron" />
    </button>
  );
}
