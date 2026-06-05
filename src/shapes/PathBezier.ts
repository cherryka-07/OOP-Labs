// src/shapes/PathBezier.ts
import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';

type Point = { x: number; y: number };

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
    anchors: Point[]; // хранятся в ЛОКАЛЬНЫХ координатах (относительно центра)
    closed: boolean;
    mode: PathMode;

    private readonly APPROX_STEPS = 32;

    constructor(anchors: Point[], props: Partial<PathBezier> & { mode?: PathMode } = {}) {
        super(props);

        // Вычисляем центр якорей в МИРОВЫХ координатах
        const worldAnchors = anchors;
        const cx = worldAnchors.reduce((sum, p) => sum + p.x, 0) / worldAnchors.length;
        const cy = worldAnchors.reduce((sum, p) => sum + p.y, 0) / worldAnchors.length;

        // Переводим якоря в ЛОКАЛЬНЫЕ координаты относительно центра
        this.anchors = worldAnchors.map((p) => ({
            x: p.x - cx,
            y: p.y - cy,
        }));

        // Устанавливаем transform, если не передан явно
        if (props.transform?.x === undefined) {
            this.transform.x = cx;
        }
        if (props.transform?.y === undefined) {
            this.transform.y = cy;
        }

        this.closed = props.closed ?? false;
        this.mode = props.mode ?? 'polyline';
    }

    // Получение якорей в МИРОВЫХ координатах (с учётом текущей трансформации)
    getWorldAnchors(): Point[] {
        return this.anchors.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });
    }

    private catmullToBeziers(
        localAnchors: Point[],
    ): Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> {
        const pts = localAnchors;
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

    private flattenCubicSegment(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
        const pts: Point[] = [];

        for (let i = 0; i <= this.APPROX_STEPS; i++) {
            const t = i / this.APPROX_STEPS;
            const mt = 1 - t;
            const x =
                mt * mt * mt * p0.x +
                3 * mt * mt * t * p1.x +
                3 * mt * t * t * p2.x +
                t * t * t * p3.x;
            const y =
                mt * mt * mt * p0.y +
                3 * mt * mt * t * p1.y +
                3 * mt * t * t * p2.y +
                t * t * t * p3.y;
            pts.push({ x, y });
        }
        return pts;
    }

    // Получение всех точек кривой в МИРОВЫХ координатах
    private getFlattenedDevice(): Point[] {
        const result: Point[] = [];
        // Используем ЛОКАЛЬНЫЕ якоря для вычислений
        const localAnchors = this.anchors;

        if (this.mode === 'polyline') {
            const end = this.closed ? localAnchors.length : localAnchors.length - 1;
            for (let i = 0; i < end; i++) {
                const [x, y] = this.transformPointToDevice(localAnchors[i].x, localAnchors[i].y);
                result.push({ x, y });
            }
            if (this.closed && localAnchors.length > 0) {
                const [x, y] = this.transformPointToDevice(localAnchors[0].x, localAnchors[0].y);
                result.push({ x, y });
            }
        } else if (this.mode === 'bezier') {
            const n = localAnchors.length;
            if (n < 2) return result;

            const segments: Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> = [];

            for (let i = 0; i < n - 1; i++) {
                const p0 = i === 0 ? localAnchors[0] : localAnchors[i - 1];
                const p1 = localAnchors[i];
                const p2 = localAnchors[i + 1];
                const p3 = i + 2 < n ? localAnchors[i + 2] : localAnchors[i + 1];

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
                const localPts = this.flattenCubicSegment(seg.p0, seg.p1, seg.p2, seg.p3);
                for (const pt of localPts) {
                    const [x, y] = this.transformPointToDevice(pt.x, pt.y);
                    if (
                        result.length > 0 &&
                        result[result.length - 1].x === x &&
                        result[result.length - 1].y === y
                    )
                        continue;
                    result.push({ x, y });
                }
            }
        } else if (this.mode === 'catmull') {
            const bezSegments = this.catmullToBeziers(localAnchors);
            for (const seg of bezSegments) {
                const localPts = this.flattenCubicSegment(seg.p0, seg.p1, seg.p2, seg.p3);
                for (const pt of localPts) {
                    const [x, y] = this.transformPointToDevice(pt.x, pt.y);
                    if (
                        result.length > 0 &&
                        result[result.length - 1].x === x &&
                        result[result.length - 1].y === y
                    )
                        continue;
                    result.push({ x, y });
                }
            }
        }

        return result;
    }

    getAllPoints(): Point[] {
        return this.getFlattenedDevice();
    }

    getLocalDevicePoints(): Point[] {
        return this.getFlattenedDevice();
    }

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

    // Контрольные точки в МИРОВЫХ координатах
    getControlPoints(): Point[] {
        return this.anchors.map((p) => ({ ...p }));
    }

    // Для получения мировых координат (если нужно где-то ещё)
    getControlPointsWorld(): Point[] {
        return this.anchors.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });
    }

    // Установка контрольной точки (принимает МИРОВЫЕ координаты)
    setControlPoint(idx: number, pt: Point): void {
        if (idx >= 0 && idx < this.anchors.length) {
            // Переводим мировые координаты в локальные
            const [lx, ly] = this.transformPointToLocal(pt.x, pt.y);
            this.anchors[idx] = { x: lx, y: ly };
        }
    }

    addPointLocal(pt: Point, index?: number): void {
        console.log('addPointLocal получил мировые:', pt);
        console.log('addPointLocal получил индекс:', index);

        // Переводим мировые координаты в локальные
        const [lx, ly] = this.transformPointToLocal(pt.x, pt.y);
        const localPt = { x: lx, y: ly };

        console.log('Преобразовано в локальные:', localPt);
        console.log(
            'Текущие anchors (локальные):',
            this.anchors.map((p) => `(${p.x}, ${p.y})`),
        );

        if (index !== undefined && index >= 0 && index <= this.anchors.length) {
            this.anchors.splice(index, 0, localPt);
            console.log(`Вставка по индексу ${index}`);
        } else {
            this.anchors.push(localPt);
            console.log('Вставка в конец');
        }

        console.log(
            'Новые anchors:',
            this.anchors.map((p) => `(${p.x}, ${p.y})`),
        );
    }

    removePoint(index: number): void {
        if (index >= 0 && index < this.anchors.length) {
            this.anchors.splice(index, 1);
        }
    }

    drawRaster(r: RasterRenderer): void {
        const pts = this.getFlattenedDevice();
        if (pts.length < 2) return;

        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);
        r.strokePolygon(pts, stroke, this.strokeWidth, this.closed);
    }

    hitTest(px: number, py: number): boolean {
        const pts = this.getFlattenedDevice();
        const threshold = Math.max(5, this.strokeWidth / 2 + 2);

        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dist = this.distToSegment({ x: px, y: py }, a, b);
            if (dist <= threshold) return true;
        }

        if (this.closed && pts.length > 1) {
            const dist = this.distToSegment({ x: px, y: py }, pts[pts.length - 1], pts[0]);
            if (dist <= threshold) return true;
        }

        return false;
    }

    private distToSegment(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    clone(): Shape {
        // Возвращаем якоря в МИРОВЫХ координатах для конструктора
        const worldAnchors = this.anchors.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });

        return new PathBezier(worldAnchors, {
            closed: this.closed,
            mode: this.mode,
            transform: { ...this.transform },
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
        });
    }

    toJSON() {
        // Сохраняем якоря в МИРОВЫХ координатах
        const worldAnchors = this.anchors.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });

        return {
            type: 'PathBezier',
            anchors: worldAnchors,
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
        const [x, y] = this.transformPointToDevice(this.anchors[idx].x, this.anchors[idx].y);
        return { x, y };
    }

    setControlPointWorld(idx: number, worldPt: Point): void {
        this.setControlPoint(idx, worldPt);
    }
}
