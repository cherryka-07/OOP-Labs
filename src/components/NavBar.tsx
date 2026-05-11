import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <header>
      <h1>VectorEngine</h1>

      <nav style={{ display: "flex", gap: "30px" }}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          Галерея
        </NavLink>

        <NavLink
          to="/editor/new"
          className={({ isActive }) =>
            isActive ? "nav-btn active" : "nav-btn"
          }
        >
          Создать
        </NavLink>
      </nav>
    </header>
  );
}