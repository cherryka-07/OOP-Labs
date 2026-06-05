// src/raster/RasterRenderer.ts
export type RGBA = { r: number; g: number; b: number; a: number };
export type LineAlg = 'bresenham' | 'wu';

export function clampByte(v: number): number {
    return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRGBA(hex: string, alpha = 255): RGBA {
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b, a: alpha };
}

export class RasterRenderer {
    private ctx: CanvasRenderingContext2D;
    private imageData: ImageData | null = null;
    private buf!: Uint8ClampedArray;
    width = 0;
    height = 0;
    dpr = 1;
    private currentDpr = 1;

    private canvas: HTMLCanvasElement;
    private onWindowResize: () => void;
    private lineAlg: LineAlg = 'bresenham';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        this.ctx = ctx;
        this.onWindowResize = () => this.resize();
        window.addEventListener('resize', this.onWindowResize);
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this.onWindowResize);
    }

    setLineAlgorithm(alg: LineAlg) {
        this.lineAlg = alg;
    }

    getLineAlgorithm(): LineAlg {
        return this.lineAlg;
    }

    private idx(x: number, y: number): number {
        return (y * this.width + x) * 4;
    }

    setPixel(x: number, y: number, color: RGBA) {
        const i = this.idx(x, y);
        this.buf[i] = color.r;
        this.buf[i + 1] = color.g;
        this.buf[i + 2] = color.b;
        this.buf[i + 3] = color.a;
    }

    private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const i = this.idx(x, y);
        const srcA = (color.a * alphaFactor) / 255;
        const dstA = this.buf[i + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA === 0) return;

        const srcR = color.r / 255;
        const srcG = color.g / 255;
        const srcB = color.b / 255;
        const dstR = this.buf[i] / 255;
        const dstG = this.buf[i + 1] / 255;
        const dstB = this.buf[i + 2] / 255;

        const outR = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
        const outG = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
        const outB = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;

        this.buf[i] = clampByte(outR * 255);
        this.buf[i + 1] = clampByte(outG * 255);
        this.buf[i + 2] = clampByte(outB * 255);
        this.buf[i + 3] = clampByte(outA * 255);
    }

    resize() {
        this.dpr = window.devicePixelRatio || 1;
        this.currentDpr = this.dpr;

        const cssWidth = this.canvas.clientWidth;
        const cssHeight = this.canvas.clientHeight;

        this.width = Math.floor(cssWidth * this.dpr);
        this.height = Math.floor(cssHeight * this.dpr);

        if (this.width === 0 || this.height === 0) return;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.buf = this.imageData.data;
    }

    beginFrame(clear = true) {
        const newDpr = window.devicePixelRatio || 1;
        if (newDpr !== this.currentDpr) {
            this.currentDpr = newDpr;
            this.resize();
        }
        if (this.width === 0 || this.height === 0) return;
        if (clear) {
            // Белый фон
            for (let i = 0; i < this.buf.length; i += 4) {
                this.buf[i] = 255; // R
                this.buf[i + 1] = 255; // G
                this.buf[i + 2] = 255; // B
                this.buf[i + 3] = 255; // A
            }
        }
    }

    commit() {
        if (!this.imageData) throw new Error('imageData is null');
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.setPixel(x0, y0, color);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
        if (steep) {
            [x0, y0] = [y0, x0];
            [x1, y1] = [y1, x1];
        }
        if (x0 > x1) {
            [x0, x1] = [x1, x0];
            [y0, y1] = [y1, y0];
        }

        const dx = x1 - x0;
        const dy = y1 - y0;
        const gradient = dx === 0 ? 1 : dy / dx;

        const xEnd0 = Math.round(x0);
        const yEnd0 = y0 + gradient * (xEnd0 - x0);
        const xGap0 = 1 - ((x0 + 0.5) % 1);
        const xPix0 = Math.floor(xEnd0);
        const yPix0 = Math.floor(yEnd0);

        if (steep) {
            this.blendPixel(yPix0, xPix0, color, (1 - (yEnd0 % 1)) * xGap0);
            this.blendPixel(yPix0 + 1, xPix0, color, (yEnd0 % 1) * xGap0);
        } else {
            this.blendPixel(xPix0, yPix0, color, (1 - (yEnd0 % 1)) * xGap0);
            this.blendPixel(xPix0, yPix0 + 1, color, (yEnd0 % 1) * xGap0);
        }

        let interY = yEnd0 + gradient;
        const xEnd1 = Math.round(x1);
        for (let x = xPix0 + 1; x < xEnd1; x++) {
            const yFloor = Math.floor(interY);
            const alphaLower = 1 - (interY % 1);
            const alphaUpper = interY % 1;
            if (steep) {
                this.blendPixel(yFloor, x, color, alphaLower);
                this.blendPixel(yFloor + 1, x, color, alphaUpper);
            } else {
                this.blendPixel(x, yFloor, color, alphaLower);
                this.blendPixel(x, yFloor + 1, color, alphaUpper);
            }
            interY += gradient;
        }

        const yEnd1 = y1 + gradient * (xEnd1 - x1);
        const xGap1 = (x1 + 0.5) % 1;
        const xPix1 = Math.floor(xEnd1);
        const yPix1 = Math.floor(yEnd1);
        if (steep) {
            this.blendPixel(yPix1, xPix1, color, (1 - (yEnd1 % 1)) * xGap1);
            this.blendPixel(yPix1 + 1, xPix1, color, (yEnd1 % 1) * xGap1);
        } else {
            this.blendPixel(xPix1, yPix1, color, (1 - (yEnd1 % 1)) * xGap1);
            this.blendPixel(xPix1, yPix1 + 1, color, (yEnd1 % 1) * xGap1);
        }
    }

    drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        if (width === 1) {
            if (this.lineAlg === 'wu') this.drawLineWu(x0, y0, x1, y1, color);
            else this.drawLineBrassenham(x0, y0, x1, y1, color);
        } else {
            this.strokeLine(x0, y0, x1, y1, color, width);
        }
    }

    private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
        if (y < 0 || y >= this.height) return;
        if (x0 > x1) [x0, x1] = [x1, x0];
        const startX = Math.max(0, Math.floor(x0));
        const endX = Math.min(this.width - 1, Math.floor(x1));
        for (let x = startX; x <= endX; x++) {
            this.blendPixel(x, y, color, 1);
        }
    }

    fillPolygon(points: { x: number; y: number }[], color: RGBA) {
        if (points.length < 3) return;
        let minY = Infinity,
            maxY = -Infinity;
        for (const p of points) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        const startY = Math.floor(minY);
        const endY = Math.ceil(maxY);
        for (let y = startY; y <= endY; y++) {
            const scanY = y + 0.5;
            const intersections: number[] = [];
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                if ((p1.y < scanY && p2.y >= scanY) || (p2.y < scanY && p1.y >= scanY)) {
                    const t = (scanY - p1.y) / (p2.y - p1.y);
                    intersections.push(p1.x + t * (p2.x - p1.x));
                }
            }
            intersections.sort((a, b) => a - b);
            for (let i = 0; i < intersections.length - 1; i += 2) {
                this.drawHSpan(y, intersections[i], intersections[i + 1], color);
            }
        }
    }

    fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
        const r2 = radius * radius;
        for (let y = -radius; y <= radius; y++) {
            const dx = Math.sqrt(r2 - y * y);
            this.drawHSpan(cy + y, cx - dx, cx + dx, color);
        }
    }

    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        const half = width / 2;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const nx = -dy / len;
        const ny = dx / len;

        const rectPoints = [
            { x: x0 - nx * half, y: y0 - ny * half },
            { x: x0 + nx * half, y: y0 + ny * half },
            { x: x1 + nx * half, y: y1 + ny * half },
            { x: x1 - nx * half, y: y1 - ny * half },
        ];
        this.fillPolygon(rectPoints, color);
    }

    strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1, closed = true) {
        if (points.length < 2) return;
        for (let i = 0; i < points.length - 1; i++) {
            this.strokeLine(
                points[i].x,
                points[i].y,
                points[i + 1].x,
                points[i + 1].y,
                color,
                width,
            );
        }
        if (closed && points.length >= 2) {
            const last = points[points.length - 1];
            const first = points[0];
            this.strokeLine(last.x, last.y, first.x, first.y, color, width);
        }
    }

    strokeCircle(cx: number, cy: number, radius: number, color: RGBA, width = 1) {
        const segments = 36;
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            pts.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
            });
        }
        this.strokePolygon(pts, color, width, true);
    }
}
