import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';

type Point = { x: number; y: number };

export class CubicBezier extends Shape {
    p0: Point; // локальные координаты
    p1: Point; // локальные координаты
    p2: Point; // локальные координаты
    p3: Point; // локальные координаты
    closed: boolean; // ← новое свойство

    // Константа для согласованной аппроксимации
    private readonly APPROX_STEPS = 64;

    constructor(p0: Point, p1: Point, p2: Point, p3: Point, props: Partial<CubicBezier> = {}) {
        super(props);

        // Вычисляем центр четырёх опорных точек (мировые координаты)
        const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
        const cy = (p0.y + p1.y + p2.y + p3.y) / 4;

        // Переводим точки в локальные координаты относительно центра
        this.p0 = { x: p0.x - cx, y: p0.y - cy };
        this.p1 = { x: p1.x - cx, y: p1.y - cy };
        this.p2 = { x: p2.x - cx, y: p2.y - cy };
        this.p3 = { x: p3.x - cx, y: p3.y - cy };

        // Устанавливаем transform, если не передан явно
        if (props.transform?.x === undefined) {
            this.transform.x = cx;
        }
        if (props.transform?.y === undefined) {
            this.transform.y = cy;
        }

        // Инициализация closed (по умолчанию false)
        this.closed = props.closed ?? false;
    }

    // Вычисляет точку кривой в ЛОКАЛЬНЫХ координатах при параметре t ∈ [0, 1]
    evalLocal(t: number): Point {
        const mt = 1 - t;
        return {
            x:
                mt * mt * mt * this.p0.x +
                3 * mt * mt * t * this.p1.x +
                3 * mt * t * t * this.p2.x +
                t * t * t * this.p3.x,
            y:
                mt * mt * mt * this.p0.y +
                3 * mt * mt * t * this.p1.y +
                3 * mt * t * t * this.p2.y +
                t * t * t * this.p3.y,
        };
    }

    // Аппроксимация кривой: возвращает точки в ЭКРАННЫХ (мировых) координатах
    flattenDevicePoints(steps = this.APPROX_STEPS): Point[] {
        const pts: Point[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const local = this.evalLocal(t);
            const [x, y] = this.transformPointToDevice(local.x, local.y);
            pts.push({ x, y });
        }
        return pts;
    }

    getLocalDevicePoints(): Point[] {
        return this.flattenDevicePoints();
    }

    // Границы в ЛОКАЛЬНЫХ координатах (по аппроксимации локальных точек)
    getLocalBounds(): Bounds {
        const pts: Point[] = [];
        for (let i = 0; i <= this.APPROX_STEPS; i++) {
            pts.push(this.evalLocal(i / this.APPROX_STEPS));
        }
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    // Границы в ЭКРАННЫХ координатах
    getBounds(): Bounds {
        const pts = this.flattenDevicePoints();
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    // Возвращает контрольные точки в ЛОКАЛЬНЫХ координатах
    getControlPoints(): Point[] {
        return [this.p0, this.p1, this.p2, this.p3];
    }

    // Устанавливает контрольную точку в ЛОКАЛЬНЫХ координатах
    setControlPoint(idx: number, pt: Point): void {
        if (idx === 0) this.p0 = pt;
        else if (idx === 1) this.p1 = pt;
        else if (idx === 2) this.p2 = pt;
        else if (idx === 3) this.p3 = pt;
    }

    // Отрисовка: использует экранные точки из аппроксимации
    drawRaster(r: RasterRenderer): void {
        const pts = this.flattenDevicePoints();
        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);
        // 🔧 Передаём this.closed вместо false
        r.strokePolygon(pts, stroke, this.strokeWidth, this.closed);
    }

    // HitTest: проверка попадания по расстоянию до аппроксимированной ломаной
    hitTest(px: number, py: number): boolean {
        const pts = this.flattenDevicePoints(128); // ↑ повышенная точность для hitTest
        if (pts.length < 2) return false;

        let minDist = Infinity;

        // Проверяем все сегменты кривой
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;

            let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));

            const projX = a.x + t * dx;
            const projY = a.y + t * dy;
            const dist = Math.hypot(px - projX, py - projY);
            minDist = Math.min(minDist, dist);
        }

        // Если кривая замкнута, проверяем сегмент от конца к началу
        if (this.closed && pts.length >= 2) {
            const a = pts[pts.length - 1]; // последняя точка
            const b = pts[0]; // первая точка
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;

            if (lenSq > 0) {
                let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));

                const projX = a.x + t * dx;
                const projY = a.y + t * dy;
                const dist = Math.hypot(px - projX, py - projY);
                minDist = Math.min(minDist, dist);
            }
        }

        // Запас в 2 пикселя на погрешность аппроксимации + мин. порог 4px для удобства
        const tolerance = Math.max(4, (this.strokeWidth || 1) + 2);
        return minDist <= tolerance;
    }

    // clone(): создаёт независимую копию с сохранением МИРОВЫХ координат
    clone(): Shape {
        // Вспомогательная функция: локальные → мировые координаты
        const toWorld = (p: Point): Point => ({
            x: p.x + this.transform.x,
            y: p.y + this.transform.y,
        });

        return new CubicBezier(
            toWorld(this.p0), // передаём мировые координаты
            toWorld(this.p1),
            toWorld(this.p2),
            toWorld(this.p3),
            {
                // 🔧 Явно передаём transform и closed
                transform: { ...this.transform },
                closed: this.closed,
                strokeStyle: this.strokeStyle,
                strokeWidth: this.strokeWidth,
                strokeOpacity: this.strokeOpacity,
                fillStyle: this.fillStyle,
                fillOpacity: this.fillOpacity,
            },
        );
    }

    // toJSON(): сериализация с МИРОВЫМИ координатами для корректной десериализации
    toJSON() {
        // Вспомогательная функция: локальные → мировые
        const toWorld = (p: Point): Point => ({
            x: p.x + this.transform.x,
            y: p.y + this.transform.y,
        });

        return {
            type: 'CubicBezier',
            // Сохраняем МИРОВЫЕ координаты контрольных точек
            p0: toWorld(this.p0),
            p1: toWorld(this.p1),
            p2: toWorld(this.p2),
            p3: toWorld(this.p3),
            // Transform и closed сохраняем как есть
            transform: { ...this.transform },
            closed: this.closed, // ← добавлено
            // Стили
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
        };
    }

    // Вспомогательный метод: получить мировые координаты контрольной точки
    getControlPointWorld(idx: number): Point | null {
        const local = this.getControlPoints()[idx];
        if (!local) return null;
        return {
            x: local.x + this.transform.x,
            y: local.y + this.transform.y,
        };
    }

    // Вспомогательный метод: установить контрольную точку в МИРОВЫХ координатах
    setControlPointWorld(idx: number, worldPt: Point): void {
        const localPt = {
            x: worldPt.x - this.transform.x,
            y: worldPt.y - this.transform.y,
        };
        this.setControlPoint(idx, localPt);
    }
}
