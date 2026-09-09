import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import Icon from "../../components/ui/Icon/Icon";
import "./HomePage.css";

const TILES = [
  {
    to: "/productos",
    icon: "box",
    title: "Productos",
    description: "Gestioná el catálogo y el stock de cada producto.",
  },
  {
    to: "/asignacion-stock",
    icon: "pin",
    title: "Asignación de stock",
    description: "Asigná stock de un producto a posiciones físicas del warehouse.",
  },
  {
    to: "/gestion-stock",
    icon: "grid",
    title: "Gestión de stock",
    description: "Consultá y administrá el stock asignado en el warehouse.",
  },
  {
    to: "/configuracion",
    icon: "map",
    title: "Configuración del warehouse",
    description: "Definí zonas, líneas y posiciones.",
  },
  {
    to: "/vehiculos",
    icon: "truck",
    title: "Vehículos",
    description: "Monitoreá el estado y la ubicación de cada vehículo.",
  },
  {
    to: "/usuarios",
    icon: "user",
    title: "Usuarios",
    description: "Administrar usuarios y sus permisos.",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <PageHeader
        title="Inicio"
        subtitle="Bienvenido a SmartWarehouse. Elegí qué querés gestionar."
      />
      <div className="home-page__grid">
        {TILES.map((tile) => (
          <Link to={tile.to} key={tile.to} className="home-page__tile">
            <Card padding="lg">
              <CardHeader
                icon={<Icon name={tile.icon} size={18} />}
                title={tile.title}
              />
              <p>{tile.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
