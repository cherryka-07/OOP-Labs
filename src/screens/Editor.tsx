import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CanvasScene } from "../raster/CanvasScene"; 
import { LineAlg } from "../raster/RasterRenderer";

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Состояние для переключения алгоритмов 
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");

  return (
    <div className="editor fade">

      {/* HEADER */}
      <header>
        <button onClick={() => navigate(-1)}>← Назад</button>
        <h1>Проект №{id}</h1>
        <button onClick={() => navigate("/")}>Сохранить</button>
      

              {/* Переключатель алгоритмов */}
        <div className="alg-toggle">
          <button 
            className={lineAlg === "bresenham" ? "active" : ""} 
            onClick={() => setLineAlg("bresenham")}
          >
            Брезенхем
          </button>
          <button 
            className={lineAlg === "wu" ? "active" : ""} 
            onClick={() => setLineAlg("wu")}
          >
            Ву (сглаживание)
          </button>
        </div>

  
      </header>



      {/* MAIN LAYOUT */}
      <div className="editor-main">

        {/* LEFT SIDEBAR */}
        <div className="sidebar-left">
          <button>⬜</button>
          <button>⚪</button>
        </div>

        {/* CANVAS */}
        <div className="canvas">
          <div className="canvas-inner">
            <CanvasScene lineAlg={lineAlg} />
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="sidebar-right">
          <h3>Свойства</h3>
          <p>Алгоритм: {lineAlg === "bresenham" ? "Брезенхем" : "Ву"}</p>
        </div>

      </div>
    </div>
  );
}