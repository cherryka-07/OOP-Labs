// src/shapes/PathBezier.ts
import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';
import { CubicBezier } from './CubicBezier';

type Point = { x: number; y: number };

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
    // anchors хранятся в МИРОВЫХ координатах
    anchors: Point[];
    closed: boolean;
    mode: PathMode;

    private readonly APPROX_STEPS = 32;
    private readonly CATMULL_TENSION = 0.5;

    constructor(anchors: Point[], props: Partial<PathBezier> & { mode?: PathMode } = {}) {
        super(props);
        this.anchors = anchors.map((p) => ({ ...p }));
        this.closed = props.closed ?? false;
        this.mode = props.mode ?? 'polyline';
    }

    // ─────────────────────────────────────────
    // 🔹 Catmull-Rom → кубические сегменты Безье
    // ─────────────────────────────────────────
    private catmullToBeziers(): Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> {
        const pts = this.anchors;
        if (pts.length < 2) return [];

        const n = pts.length;
        const segments: Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> = [];
        const count = this.closed ? n : n - 1;

        for (let i = 0; i < count; i++) {
            const p0 = this.closed ? pts[(i - 1 + n) % n] : i === 0 ? pts[0] : pts[i - 1];
            const p1 = pts[i];
            const p2 = this.closed ? pts[(i + 1) % n] : i + 1 < n ? pts[i + 1] : pts[n - 1];
            const p3 = this.closed ? pts[(i + 2) % n] : i + 2 < n ? pts[i + 2] : pts[n - 1];

            const tension = 0.5;
            segments.push({
                p0: { ...p1 },
                p1: {
                    x: p1.x + ((p2.x - p0.x) * tension) / 2,
                    y: p1.y + ((p2.y - p0.y) * tension) / 2,
                },
                p2: {
                    x: p2.x - ((p3.x - p1.x) * tension) / 2,
                    y: p2.y - ((p3.y - p1.y) * tension) / 2,
                },
                p3: { ...p2 },
            });
        }
        return segments;
    }

    // ─────────────────────────────────────────
    // 🔹 Аппроксимация кубического сегмента в экранных координатах
    // ─────────────────────────────────────────
    private flattenCubicSegment(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
        const pts: Point[] = [];

        // 🔧 transformPointToDevice возвращает [number, number] — деструктурируем
        const [x0, y0] = this.transformPointToDevice(p0.x, p0.y);
        const [x1, y1] = this.transformPointToDevice(p1.x, p1.y);
        const [x2, y2] = this.transformPointToDevice(p2.x, p2.y);
        const [x3, y3] = this.transformPointToDevice(p3.x, p3.y);

        for (let i = 0; i <= this.APPROX_STEPS; i++) {
            const t = i / this.APPROX_STEPS;
            const mt = 1 - t;
            const x = mt ** 3 * x0 + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3;
            const y = mt ** 3 * y0 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3;
            pts.push({ x, y });
        }
        return pts;
    }

    // ─────────────────────────────────────────
    // 🔹 Вычисление экранной ломаной для всего пути
    // ─────────────────────────────────────────
    private getFlattenedDevice(): Point[] {
        const result: Point[] = [];
        const pts = this.anchors;

        if (this.mode === 'polyline') {
            const end = this.closed ? pts.length : pts.length - 1;
            for (let i = 0; i < end; i++) {
                // 🔧 Деструктурируем [number, number] в объект Point
                const [x, y] = this.transformPointToDevice(pts[i].x, pts[i].y);
                result.push({ x, y });
            }
            if (this.closed && pts.length > 0) {
                const [x, y] = this.transformPointToDevice(pts[0].x, pts[0].y);
                result.push({ x, y });
            }
        } else if (this.mode === 'bezier') {
            // 🔧 Логика как у препода: скользящее окно, не шаг 4
            const n = pts.length;
            if (n < 2) return result;

            const segments: Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> = [];

            for (let i = 0; i < n - 1; i++) {
                const p0 = i === 0 ? pts[0] : pts[i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = i + 2 < n ? pts[i + 2] : pts[i + 1];

                const tension = 0.5;
                const cp1 = {
                    x: p1.x + (p2.x - p0.x) * tension * 0.5,
                    y: p1.y + (p2.y - p0.y) * tension * 0.5,
                };
                const cp2 = {
                    x: p2.x - (p3.x - p1.x) * tension * 0.5,
                    y: p2.y - (p3.y - p1.y) * tension * 0.5,
                };
                segments.push({ p0: p1, p1: cp1, p2: cp2, p3: p2 });
            }

            for (const seg of segments) {
                const segmentPoints = this.flattenCubicSegment(seg.p0, seg.p1, seg.p2, seg.p3);
                if (result.length > 0 && segmentPoints.length > 0) {
                    result.pop();
                }
                result.push(...segmentPoints);
            }
        } else if (this.mode === 'catmull') {
            const bezSegments = this.catmullToBeziers();
            for (const seg of bezSegments) {
                const segmentPoints = this.flattenCubicSegment(seg.p0, seg.p1, seg.p2, seg.p3);
                if (result.length > 0 && segmentPoints.length > 0) {
                    result.pop();
                }
                result.push(...segmentPoints);
            }
        }

        return result;
    }

    // ─────────────────────────────────────────
    // 🔹 Публичные методы для совместимости
    // ─────────────────────────────────────────
    getAllPoints(): Point[] {
        return this.getFlattenedDevice();
    }

    getLocalDevicePoints(): Point[] {
        return this.getFlattenedDevice();
    }

    // ─────────────────────────────────────────
    // 🔹 Границы
    // ─────────────────────────────────────────
    getLocalBounds(): Bounds {
        if (this.anchors.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        const xs = this.anchors.map((p) => p.x);
        const ys = this.anchors.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    getBounds(): Bounds {
        const flat = this.getFlattenedDevice();
        if (flat.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        const xs = flat.map((p) => p.x);
        const ys = flat.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    // ─────────────────────────────────────────
    // 🔹 Управление точками
    // ─────────────────────────────────────────
    getControlPoints(): Point[] {
        return this.anchors.map((p) => ({ ...p }));
    }

    setControlPoint(idx: number, pt: Point): void {
        if (idx >= 0 && idx < this.anchors.length) {
            this.anchors[idx] = { ...pt };
        }
    }

    addPointLocal(pt: Point, index?: number): void {
        if (index !== undefined && index >= 0 && index <= this.anchors.length) {
            this.anchors.splice(index, 0, { ...pt });
        } else {
            this.anchors.push({ ...pt });
        }
    }

    removePoint(index: number): void {
        if (index >= 0 && index < this.anchors.length) {
            this.anchors.splice(index, 1);
        }
    }

    // ─────────────────────────────────────────
    // 🔹 Отрисовка
    // ─────────────────────────────────────────
    drawRaster(r: RasterRenderer): void {
        const pts = this.getFlattenedDevice();
        if (pts.length < 2) return;

        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);

        // 🔧 Передаём this.closed — как у препода
        r.strokePolygon(pts, stroke, this.strokeWidth, this.closed);
    }

    // ─────────────────────────────────────────
    // 🔹 HitTest
    // ─────────────────────────────────────────
    hitTest(px: number, py: number): boolean {
        // 🔧 transformPointToLocal возвращает [number, number] → преобразуем в Point
        const [lx, ly] = this.transformPointToLocal(px, py);
        const local: Point = { x: lx, y: ly };

        const threshold = Math.max(5, (this.strokeWidth || 1) / 2 + 2);

        if (this.mode === 'polyline') {
            return this.hitTestPolyline(local, threshold);
        } else if (this.mode === 'bezier') {
            const n = this.anchors.length;
            for (let i = 0; i < n - 1; i++) {
                const p0 = i === 0 ? this.anchors[0] : this.anchors[i - 1];
                const p1 = this.anchors[i];
                const p2 = this.anchors[i + 1];
                const p3 = i + 2 < n ? this.anchors[i + 2] : this.anchors[i + 1];

                const tension = 0.5;
                const cp1 = {
                    x: p1.x + (p2.x - p0.x) * tension * 0.5,
                    y: p1.y + (p2.y - p0.y) * tension * 0.5,
                };
                const cp2 = {
                    x: p2.x - (p3.x - p1.x) * tension * 0.5,
                    y: p2.y - (p3.y - p1.y) * tension * 0.5,
                };

                if (this.hitTestCubicBezier(local, p1, cp1, cp2, p2, threshold)) {
                    return true;
                }
            }
            return false;
        } else if (this.mode === 'catmull') {
            const segs = this.catmullToBeziers();
            for (const seg of segs) {
                if (this.hitTestCubicBezier(local, seg.p0, seg.p1, seg.p2, seg.p3, threshold)) {
                    return true;
                }
            }
            return false;
        }
        return false;
    }

    private hitTestPolyline(localPt: Point, threshold: number): boolean {
        const pts = this.anchors;
        for (let i = 0; i < pts.length - 1; i++) {
            if (this.distToSegment(localPt, pts[i], pts[i + 1]) <= threshold) return true;
        }
        if (this.closed && pts.length > 1) {
            if (this.distToSegment(localPt, pts[pts.length - 1], pts[0]) <= threshold) return true;
        }
        return false;
    }

    private hitTestCubicBezier(
        localPt: Point,
        p0: Point,
        p1: Point,
        p2: Point,
        p3: Point,
        threshold: number,
    ): boolean {
        const steps = 50;
        for (let i = 0; i < steps; i++) {
            const t1 = i / steps;
            const t2 = (i + 1) / steps;
            const pt1 = this.evalCubic(t1, p0, p1, p2, p3);
            const pt2 = this.evalCubic(t2, p0, p1, p2, p3);
            if (this.distToSegment(localPt, pt1, pt2) <= threshold) return true;
        }
        return false;
    }

    private evalCubic(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
        const mt = 1 - t;
        return {
            x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
            y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
        };
    }

    private distToSegment(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x,
            dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t * dx,
            projY = a.y + t * dy;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    // ─────────────────────────────────────────
    // 🔹 Сериализация и клонирование
    // ─────────────────────────────────────────
    clone(): Shape {
        return new PathBezier(
            this.anchors.map((p) => ({ ...p })),
            {
                closed: this.closed,
                mode: this.mode,
                transform: { ...this.transform },
                strokeStyle: this.strokeStyle,
                strokeWidth: this.strokeWidth,
                strokeOpacity: this.strokeOpacity,
                fillStyle: this.fillStyle,
                fillOpacity: this.fillOpacity,
            },
        );
    }

    toJSON() {
        return {
            type: 'PathBezier',
            anchors: this.anchors.map((p) => ({ ...p })),
            closed: this.closed,
            mode: this.mode,
            transform: { ...this.transform },
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
        };
    }

    getControlPointWorld(idx: number): Point | null {
        if (idx < 0 || idx >= this.anchors.length) return null;
        return { ...this.anchors[idx] };
    }

    setControlPointWorld(idx: number, worldPt: Point): void {
        this.setControlPoint(idx, worldPt);
    }
}
