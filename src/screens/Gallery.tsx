import { useState } from "react";
import { Link } from "react-router-dom";



type Project = {
  id: string;
  name: string;
  date: string;
};

export default function Gallery() {
  const [projects, setProjects] = useState<Project[]>([]);

  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: `Проект ${projects.length + 1}`,
      date: new Date().toLocaleDateString(),
    };

    setProjects([...projects, newProject]);
  };

  return (


    <div className="gallery fade">
      <div className="gallery-header">
        <h1> Галерея проектов</h1>

        <button onClick={addProject}>
          + Создать проект
        </button>
      </div>

      <div className="grid">
        {projects.map((p) => (
          <Link key={p.id} to={`/editor/${p.id}`}>
            <div className="card">
              <h3>{p.name}</h3>
              <p>{p.date}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}