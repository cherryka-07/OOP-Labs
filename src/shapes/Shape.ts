import { Transform, Bounds } from './types';
import { RasterRenderer, RGBA } from '../raster/RasterRenderer';

export abstract class Shape {
    id: string;
    transform: Transform;
    fillStyle: string;
    fillOpacity: number;
    strokeStyle: string;
    strokeWidth: number;
    strokeOpacity: number;

    constructor(props: Partial<Shape> = {}) {
        this.id = props.id || crypto.randomUUID();
        this.transform = {
            x: props.transform?.x ?? 0,
            y: props.transform?.y ?? 0,
            rotation: props.transform?.rotation ?? 0,
            scaleX: props.transform?.scaleX ?? 1,
            scaleY: props.transform?.scaleY ?? 1,
        };
        this.fillStyle = props.fillStyle || '#000000';
        this.fillOpacity = props.fillOpacity ?? 1;
        this.strokeStyle = props.strokeStyle || '#000000';
        this.strokeWidth = props.strokeWidth ?? 1;
        this.strokeOpacity = props.strokeOpacity ?? 1;
    }

    //10.1: Матрица преобразования из локальной в экранную систему
    getLocalToDeviceMatrix(): number[][] {
        const { x, y, rotation, scaleX, scaleY } = this.transform;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return [
            [scaleX * cos, -scaleY * sin, x],
            [scaleX * sin, scaleY * cos, y],
            [0, 0, 1],
        ];
    }

    //10.1: Обратная матрица (из экранной в локальную)
    getDeviceToLocalMatrix(): number[][] {
        const m = this.getLocalToDeviceMatrix();
        const [a, c, tx] = m[0];
        const [b, d, ty] = m[1];
        const det = a * d - b * c;
        if (Math.abs(det) < 1e-6) {
            return [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ];
        }
        const invDet = 1 / det;
        return [
            [d * invDet, -c * invDet, (c * ty - d * tx) * invDet],
            [-b * invDet, a * invDet, (b * tx - a * ty) * invDet],
            [0, 0, 1],
        ];
    }

    // Преобразование точки из локальной в экранную
    transformPointToDevice(px: number, py: number): [number, number] {
        const m = this.getLocalToDeviceMatrix();
        return [px * m[0][0] + py * m[0][1] + m[0][2], px * m[1][0] + py * m[1][1] + m[1][2]];
    }

    // Преобразование точки из экранной в локальную (для hitTest)
    transformPointToLocal(px: number, py: number): [number, number] {
        const m = this.getDeviceToLocalMatrix();
        return [px * m[0][0] + py * m[0][1] + m[0][2], px * m[1][0] + py * m[1][1] + m[1][2]];
    }

    // Получить центр фигуры
    getCenter(): { x: number; y: number } {
        const b = this.getBounds();
        return {
            x: (b.minX + b.maxX) / 2,
            y: (b.minY + b.maxY) / 2,
        };
    }

    // 10.5: Вычисление границ в экранных координатах
    getBounds(): Bounds {
        const points = this.getLocalDevicePoints();
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    // Изменение размера по новым экранным границам
    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number) {
        const local = this.getLocalBounds();
        const wLocal = local.maxX - local.minX || 1;
        const hLocal = local.maxY - local.minY || 1;
        const wNew = maxX - minX;
        const hNew = maxY - minY;

        this.transform.scaleX = wNew / wLocal;
        this.transform.scaleY = hNew / hLocal;
        this.transform.x = minX - local.minX * this.transform.scaleX;
        this.transform.y = minY - local.minY * this.transform.scaleY;
    }

    //  Обёртка для изменения границ
    setBounds(minX: number, minY: number, maxX: number, maxY: number) {
        this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
    }

    // Абстрактные методы (должны быть реализованы в наследниках)
    abstract getLocalBounds(): Bounds;
    abstract getLocalDevicePoints(): { x: number; y: number }[];
    abstract drawRaster(r: RasterRenderer): void;
    abstract hitTest(px: number, py: number): boolean;
    abstract clone(): Shape;
    abstract toJSON(): any;

    // Вспомогательный метод для конвертации HEX в RGBA
    protected hexToRGBA(hex: string): { r: number; g: number; b: number; a: number } {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16),
            a: 255,
        };
    }
}
