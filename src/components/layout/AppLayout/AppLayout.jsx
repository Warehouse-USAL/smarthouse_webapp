import { Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-layout__main">
        <div className="app-layout__container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
