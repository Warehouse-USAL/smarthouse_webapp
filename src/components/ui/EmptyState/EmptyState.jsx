import Icon from "../Icon/Icon";
import "./EmptyState.css";

export default function EmptyState({ icon = "box", title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={32} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
