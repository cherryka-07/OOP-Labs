// src/shapes/React.ts
import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';

export class Rect extends Shape {
    width: number;
    height: number;

    constructor(w: number, h: number, props: Partial<Rect> = {}) {
        super(props);
        this.width = w;
        this.height = h;
    }

    getLocalBounds(): Bounds {
        return {
            minX: -this.width / 2,
            minY: -this.height / 2,
            maxX: this.width / 2,
            maxY: this.height / 2,
        };
    }

    getLocalDevicePoints(): { x: number; y: number }[] {
        const hw = this.width / 2;
        const hh = this.height / 2;
        const localCorners = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh },
        ];

        return localCorners.map((p) => {
            const [dx, dy] = this.transformPointToDevice(p.x, p.y);
            return { x: dx, y: dy };
        });
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

    hitTest(px: number, py: number): boolean {
        const [lx, ly] = this.transformPointToLocal(px, py);
        return Math.abs(lx) <= this.width / 2 && Math.abs(ly) <= this.height / 2;
    }

    clone(): Shape {
        return new Rect(this.width, this.height, {
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
            type: 'Rect',
            width: this.width,
            height: this.height,
            transform: this.transform,
            fillStyle: this.fillStyle,
            strokeStyle: this.strokeStyle,
        };
    }
}
