import { useEffect, useRef } from 'react';
import { RasterRenderer, LineAlg } from './RasterRenderer';
import { Rect, Line, Oval, Triangle, QuadraticBezier, CubicBezier, PathBezier } from '../shapes';

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
                fillStyle: '#ff4444',
                fillOpacity: 0.8,
                strokeStyle: '#000000',
                strokeWidth: 2,
            });

            const line = new Line(0, 0, 250, 150, {
                transform: { x: 300, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
                strokeStyle: '#023e02',
                strokeWidth: 4,
            });

            const oval = new Oval(80, 60, {
                transform: { x: 650, y: 380, rotation: Math.PI / 6, scaleX: 1, scaleY: 1 },
                fillStyle: '#4444ff',
                fillOpacity: 0.6,
                strokeStyle: '#000000',
                strokeWidth: 1,
            });

            const quadBezier = new QuadraticBezier(
                { x: 350, y: 550 },
                { x: 450, y: 420 },
                { x: 550, y: 550 },
                {
                    transform: {
                        x: 750,
                        y: 600,
                        rotation: Math.PI / 6,
                        scaleX: 1,
                        scaleY: 1,
                    },

                    strokeStyle: '#ff00ff',
                    strokeWidth: 4,
                },
            );

            const triangle = new Triangle(
                { x: 170, y: 150 },
                { x: 300, y: 120 },
                { x: 220, y: 280 },
                {
                    fillStyle: '#6fff00',
                    fillOpacity: 0.7,

                    strokeStyle: '#000000',
                    strokeWidth: 3,
                },
            );

            const cubic = new CubicBezier(
                { x: 200, y: 700 },
                { x: 250, y: 350 },
                { x: 350, y: 900 },
                { x: 450, y: 550 },
                {
                    strokeStyle: '#00ffff',
                    strokeWidth: 3,
                },
            );

            const pathQuadratic = new PathBezier(
                [
                    { x: 750, y: 440 },
                    { x: 800, y: 340 },
                    { x: 850, y: 460 },
                    { x: 900, y: 340 },
                    { x: 960, y: 500 },
                    { x: 980, y: 420 },
                ],
                {
                    mode: 'quadratic',
                    closed: false,
                    strokeStyle: '#9b59b6',
                    strokeWidth: 3,
                },
            );

            // PathBezier + cubic mode
            // Формат: [P0,P1,P2,P3] → 1 сегмент; +3 точки = +1 сегмент
            const pathCubic = new PathBezier(
                [
                    { x: 750, y: 340 },
                    { x: 800, y: 240 },
                    { x: 850, y: 360 },
                    { x: 900, y: 240 },
                    { x: 960, y: 400 },
                    { x: 980, y: 320 },
                ],
                {
                    mode: 'cubic',
                    closed: false,
                    strokeStyle: '#3498db',
                    strokeWidth: 3,
                },
            );

            //  PathBezier + catmull mode
            // Кривая проходит через ВСЕ точки (интерполяция)

            const pathCatmull = new PathBezier(
                [
                    { x: 750, y: 140 },
                    { x: 800, y: 40 },
                    { x: 850, y: 160 },
                    { x: 900, y: 40 },
                    { x: 960, y: 200 },
                    { x: 980, y: 120 },
                ],
                {
                    strokeStyle: '#ff0000',
                    strokeWidth: 4,
                    closed: false,
                    mode: 'catmull',
                },
            );

            // Отрисовка
            rect.drawRaster(r);
            line.drawRaster(r);
            oval.drawRaster(r);
            quadBezier.drawRaster(r);
            triangle.drawRaster(r);
            cubic.drawRaster(r);

            pathQuadratic.drawRaster(r);
            pathCubic.drawRaster(r);
            pathCatmull.drawRaster(r);

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
        <div ref={containerRef} style={{ width: '800px', height: '600px' }}>
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    );
};
