import { useEffect, useRef } from "react";
import { RasterRenderer, LineAlg } from "./RasterRenderer";
import { Rect, Line, Oval } from "../shapes";

interface CanvasSceneProps {
  lineAlg: LineAlg;
}

export const CanvasScene = ({ lineAlg }: CanvasSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => {
      renderer.resize();
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    let raf = 0;

    const frame = () => {
      const r = rendererRef.current;
      if (!r) return;

      r.beginFrame(true);

      // Создаём фигуры Lab 5
      const rect = new Rect(200, 150, {
        transform: { x: 550, y: 350, rotation: 0, scaleX: 1, scaleY: 1 },
        fillStyle: "#ff4444",
        fillOpacity: 0.8,
        strokeStyle: "#000000",
        strokeWidth: 2,
      });

      const line = new Line(0, 0, 250, 150, {
        transform: { x: 300, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
        strokeStyle: "#023e02",
        strokeWidth: 4,
      });

      const oval = new Oval(80, 60, {
        transform: { x: 650, y: 380, rotation: Math.PI / 6, scaleX: 1, scaleY: 1 },
        fillStyle: "#4444ff",
        fillOpacity: 0.6,
        strokeStyle: "#000000",
        strokeWidth: 1,
      });

      // Отрисовка 
      rect.drawRaster(r);
      line.drawRaster(r);
      oval.drawRaster(r);

      r.commit();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "800px", height: "600px" }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};