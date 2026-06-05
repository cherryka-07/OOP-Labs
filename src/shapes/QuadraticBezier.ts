import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';
import { PathBezier } from './PathBezier';

type Point = { x: number; y: number };

export class QuadraticBezier extends Shape {
    private _p0: Point;
    private _p1: Point;
    private _p2: Point;
    private readonly APPROX_STEPS = 64;

    constructor(p0: Point, p1: Point, p2: Point, props: Partial<QuadraticBezier> = {}) {
        super(props);
        const steps = 64;
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
            const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        this._p0 = { x: p0.x - cx, y: p0.y - cy };
        this._p1 = { x: p1.x - cx, y: p1.y - cy };
        this._p2 = { x: p2.x - cx, y: p2.y - cy };
        if (props.transform?.x === undefined) this.transform.x = cx;
        if (props.transform?.y === undefined) this.transform.y = cy;
    }

    evalLocal(t: number): Point {
        const mt = 1 - t;
        return {
            x: mt * mt * this._p0.x + 2 * mt * t * this._p1.x + t * t * this._p2.x,
            y: mt * mt * this._p0.y + 2 * mt * t * this._p1.y + t * t * this._p2.y,
        };
    }

    getWorldPoints(steps = this.APPROX_STEPS): Point[] {
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
        return this.getWorldPoints();
    }

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

    getBounds(): Bounds {
        const pts = this.getWorldPoints();
        if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    getControlPoints(): Point[] {
        return [this._p0, this._p1, this._p2];
    }

    setControlPoint(idx: number, pt: Point): void {
        switch (idx) {
            case 0:
                this._p0 = { ...pt };
                break;
            case 1:
                this._p1 = { ...pt };
                break;
            case 2:
                this._p2 = { ...pt };
                break;
        }
    }

    addPointLocal(pt: Point, index?: number): void {
        const worldPoints = this.getWorldPoints();
        const pathBezier = new PathBezier(worldPoints, {
            mode: 'bezier',
            closed: false,
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
            transform: { ...this.transform },
        });
        pathBezier.addPointLocal({ x: pt.x, y: pt.y }, index);
        (this as any).__convertToPath = pathBezier;
        alert('Кривая преобразована в PathBezier для добавления точек');
    }

    removePoint(index: number): void {
        alert('Квадратичная кривая Безье имеет 3 фиксированные точки');
    }

    drawRaster(r: RasterRenderer): void {
        const pts = this.getWorldPoints();
        if (pts.length < 2) return;
        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);
        r.strokePolygon(pts, stroke, this.strokeWidth, false);
    }

    hitTest(px: number, py: number): boolean {
        const pts = this.getWorldPoints(128);
        let minDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i],
                b = pts[i + 1];
            const dx = b.x - a.x,
                dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;
            let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = a.x + t * dx,
                projY = a.y + t * dy;
            const dist = Math.hypot(px - projX, py - projY);
            minDist = Math.min(minDist, dist);
        }
        const tolerance = Math.max(4, (this.strokeWidth || 1) + 2);
        return minDist <= tolerance;
    }

    clone(): Shape {
        const worldPoints = [
            { x: this._p0.x + this.transform.x, y: this._p0.y + this.transform.y },
            { x: this._p1.x + this.transform.x, y: this._p1.y + this.transform.y },
            { x: this._p2.x + this.transform.x, y: this._p2.y + this.transform.y },
        ];
        return new QuadraticBezier(worldPoints[0], worldPoints[1], worldPoints[2], {
            transform: { ...this.transform },
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
        });
    }

    toJSON() {
        const worldPoints = [
            { x: this._p0.x + this.transform.x, y: this._p0.y + this.transform.y },
            { x: this._p1.x + this.transform.x, y: this._p1.y + this.transform.y },
            { x: this._p2.x + this.transform.x, y: this._p2.y + this.transform.y },
        ];
        return {
            type: 'QuadraticBezier',
            p0: worldPoints[0],
            p1: worldPoints[1],
            p2: worldPoints[2],
            transform: { ...this.transform },
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
        };
    }

    getControlPointWorld(idx: number): Point | null {
        const pts = this.getControlPoints();
        if (idx < 0 || idx >= pts.length) return null;
        const [x, y] = this.transformPointToDevice(pts[idx].x, pts[idx].y);
        return { x, y };
    }

    setControlPointWorld(idx: number, worldPt: Point): void {
        const local = this.transformPointToLocal(worldPt.x, worldPt.y);
        if (local) this.setControlPoint(idx, { x: local[0], y: local[1] });
    }
}
