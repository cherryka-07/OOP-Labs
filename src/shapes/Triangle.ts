import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';

type Point = { x: number; y: number };

export class Triangle extends Shape {
    points: Point[];

    constructor(p1: Point, p2: Point, p3: Point, props: Partial<Triangle> = {}) {
        super(props);

        // центр треугольника
        const cx = (p1.x + p2.x + p3.x) / 3;
        const cy = (p1.y + p2.y + p3.y) / 3;

        // локальные координаты
        this.points = [
            { x: p1.x - cx, y: p1.y - cy },
            { x: p2.x - cx, y: p2.y - cy },
            { x: p3.x - cx, y: p3.y - cy },
        ];

        if (props.transform?.x === undefined) {
            this.transform.x = cx;
        }

        if (props.transform?.y === undefined) {
            this.transform.y = cy;
        }
    }

    getLocalBounds(): Bounds {
        const xs = this.points.map((p) => p.x);
        const ys = this.points.map((p) => p.y);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    getLocalDevicePoints(): Point[] {
        return this.points.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });
    }

    getBounds(): Bounds {
        const pts = this.getLocalDevicePoints(); // уже преобразованные в экранные координаты
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    drawRaster(r: RasterRenderer): void {
        const pts = this.getLocalDevicePoints();

        const fill = this.hexToRGBA(this.fillStyle);
        fill.a = Math.floor(this.fillOpacity * 255);

        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);

        r.fillPolygon(pts, fill);

        if (this.strokeWidth > 0) {
            r.strokePolygon(pts, stroke, this.strokeWidth);
        }
    }

    private sign(p1: Point, p2: Point, p3: Point): number {
        return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    }

    hitTest(px: number, py: number): boolean {
        const [lx, ly] = this.transformPointToLocal(px, py);

        const p = { x: lx, y: ly };

        const [a, b, c] = this.points;

        const d1 = this.sign(p, a, b);
        const d2 = this.sign(p, b, c);
        const d3 = this.sign(p, c, a);

        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

        return !(hasNeg && hasPos);
    }

    clone(): Shape {
        const pts = this.points.map((p) => {
            const [x, y] = this.transformPointToDevice(p.x, p.y);
            return { x, y };
        });

        return new Triangle(pts[0], pts[1], pts[2], {
            transform: { ...this.transform },
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,

            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
    }

    toJSON() {
        return {
            type: 'Triangle',
            points: this.getLocalDevicePoints(),
            transform: this.transform,
            fillStyle: this.fillStyle,
            strokeStyle: this.strokeStyle,
        };
    }
}
