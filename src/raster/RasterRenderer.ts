export type RGBA = { r: number; g: number; b: number; a: number };

export type LineAlg = 'bresenham' | 'wu';
// TODO: Ограничение значения байта (0–255)
export function clampByte(v: number): number {
    return Math.max(0, Math.min(255, Math.round(v)));
}

// TODO: Парсинг HEX в RGBA
export function hexToRGBA(hex: string, alpha = 255): RGBA {
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
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

    private canvas: HTMLCanvasElement;
    private _onWindowResize: () => void;
    private lineAlg: LineAlg = 'bresenham';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        this.ctx = ctx;
        this._onWindowResize = () => this.resize();
        window.addEventListener('resize', this._onWindowResize);
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    setLineAlgorithm(a: LineAlg) { this.lineAlg = a; }
    getLineAlgorithm(): LineAlg { return this.lineAlg; }

    drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        if (this.lineAlg === 'wu') {
            this.drawLineWu(x0, y0, x1, y1, color);
        } else {
            this.drawLineBrassenham(x0, y0, x1, y1, color);
        }
    }

    // 1.1: Индекс в линейном буфере
    private idx(x: number, y: number): number {
        return (y * this.width + x) * 4;
    }

    // Прямая запись пикселя (без блендинга)
    setPixel(x: number, y: number, color: RGBA) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const i = this.idx(x, y);
        this.buf[i] = color.r;
        this.buf[i + 1] = color.g;
        this.buf[i + 2] = color.b;
        this.buf[i + 3] = color.a;
    }

    // 1.4: Alpha blending с Premultiplied Alpha
    private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const i = this.idx(x, y);
        
        const srcA = (color.a * alphaFactor) / 255;
        if (srcA <= 0) return;
        
        // Оптимизация: полностью непрозрачный — просто записываем
        if (srcA >= 1) {
            this.buf[i] = color.r;
            this.buf[i + 1] = color.g;
            this.buf[i + 2] = color.b;
            this.buf[i + 3] = 255;
            return;
        }
        
        const dstR = this.buf[i];
        const dstG = this.buf[i + 1];
        const dstB = this.buf[i + 2];
        const dstA = this.buf[i + 3] / 255;
        
        // Premultiplied Alpha: C'out = C'src + C'dst * (1 - αsrc)
        const outR = color.r * srcA + dstR * (1 - srcA);
        const outG = color.g * srcA + dstG * (1 - srcA);
        const outB = color.b * srcA + dstB * (1 - srcA);
        const outA = srcA + dstA * (1 - srcA);
        
        this.buf[i]     = clampByte(outR);
        this.buf[i + 1] = clampByte(outG);
        this.buf[i + 2] = clampByte(outB);
        this.buf[i + 3] = clampByte(outA * 255);
    }

    // 2.1: Resize с учётом DPR
    resize() {
        this.dpr = window.devicePixelRatio || 1;
        const cssWidth = this.canvas.clientWidth;
        const cssHeight = this.canvas.clientHeight;
        
        this.width = Math.floor(cssWidth * this.dpr);
        this.height = Math.floor(cssHeight * this.dpr);
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.buf = this.imageData.data;
    }

    // Очистка буфера в прозрачный чёрный
    beginFrame(clear = true): void {
        if (clear && this.buf) {
            this.buf.fill(0);
        }
    }

    // Вывод на экран
    commit(): void {
        if (this.imageData && this.buf) {
            this.ctx.putImageData(this.imageData, 0, 0);
        }
    }

    // 1.5: Алгоритм Брезенхема (целочисленный)
    drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = x0 < x1 ? 1 : -1;
        let sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
            this.setPixel(Math.round(x0), Math.round(y0), color);
            if (Math.round(x0) === Math.round(x1) && Math.round(y0) === Math.round(y1)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    //  1.6: Алгоритм Ву 
    drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        const ipart = (x: number) => Math.floor(x);
        const fpart = (x: number) => x - Math.floor(x);
        const rfpart = (x: number) => 1 - fpart(x);

        let steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

        if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
        if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
        
        const dx = x1 - x0;
        const dy = y1 - y0;
        const gradient = dx === 0 ? 0 : dy / dx;

        // Первая точка
        let xEnd = Math.round(x0);
        let yEnd = y0 + gradient * (xEnd - x0);
        let xGap = rfpart(x0 + 0.5);
        const xPixel1 = xEnd, yPixel1 = ipart(yEnd);
        
        if (steep) {
            this.blendPixel(yPixel1, xPixel1, color, rfpart(yEnd) * xGap);
            this.blendPixel(yPixel1 + 1, xPixel1, color, fpart(yEnd) * xGap);
        } else {
            this.blendPixel(xPixel1, yPixel1, color, rfpart(yEnd) * xGap);
            this.blendPixel(xPixel1, yPixel1 + 1, color, fpart(yEnd) * xGap);
        }
        
        let intery = yEnd + gradient;

        // Основной цикл
        for (let x = xEnd + 1; x < Math.round(x1); x++) {
            if (steep) {
                this.blendPixel(ipart(intery), x, color, rfpart(intery));
                this.blendPixel(ipart(intery) + 1, x, color, fpart(intery));
            } else {
                this.blendPixel(x, ipart(intery), color, rfpart(intery));
                this.blendPixel(x, ipart(intery) + 1, color, fpart(intery));
            }
            intery += gradient;
        }

        // Последняя точка
        xEnd = Math.round(x1);
        yEnd = y1 + gradient * (xEnd - x1);
        xGap = fpart(x1 + 0.5);
        const xPixel2 = xEnd, yPixel2 = ipart(yEnd);
        
        if (steep) {
            this.blendPixel(yPixel2, xPixel2, color, rfpart(yEnd) * xGap);
            this.blendPixel(yPixel2 + 1, xPixel2, color, fpart(yEnd) * xGap);
        } else {
            this.blendPixel(xPixel2, yPixel2, color, rfpart(yEnd) * xGap);
            this.blendPixel(xPixel2, yPixel2 + 1, color, fpart(yEnd) * xGap);
        }
    }

    // 2.2: Горизонтальная линия для заливки
    private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
        if (x0 > x1) [x0, x1] = [x1, x0];
        x0 = Math.max(0, Math.floor(x0));
        x1 = Math.min(this.width - 1, Math.floor(x1));
        if (y < 0 || y >= this.height) return;
        for (let x = x0; x <= x1; x++) {
            this.blendPixel(x, y, color);
        }
    }

    // 2.3: Заливка полигона (Scanline + Even-Odd Rule)
    fillPolygon(points: { x: number; y: number }[], color: RGBA) {
        if (points.length < 3) return;
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const intersections: number[] = [];
            const scanY = y + 0.5;
            
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                if ((p1.y <= scanY && p2.y > scanY) || (p2.y <= scanY && p1.y > scanY)) {
                    const t = (scanY - p1.y) / (p2.y - p1.y);
                    const x = p1.x + t * (p2.x - p1.x);
                    intersections.push(x);
                }
            }
            intersections.sort((a, b) => a - b);
            for (let i = 0; i < intersections.length - 1; i += 2) {
                this.drawHSpan(y, intersections[i], intersections[i + 1], color);
            }
        }
    }

    // Заливка окружности через HSpan
    fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
            const dy = y - cy;
            const dx = Math.sqrt(Math.max(0, radius * radius - dy * dy));
            this.drawHSpan(y, cx - dx, cx + dx, color);
        }
    }

    // 2.5: Толстая линия (прямоугольник + круглые шапки)
    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) {
            this.fillCircle(x0, y0, width / 2, color);
            return;
        }
        const nx = -dy / len, ny = dx / len;
        const half = width / 2;
        const rect = [
            { x: x0 + nx * half, y: y0 + ny * half },
            { x: x0 - nx * half, y: y0 - ny * half },
            { x: x1 - nx * half, y: y1 - ny * half },
            { x: x1 + nx * half, y: y1 + ny * half },
        ];
        this.fillPolygon(rect, color);
        this.fillCircle(x0, y0, half, color);
        this.fillCircle(x1, y1, half, color);
    }

    // Контур полигона с круглыми стыками
    strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1, closed = true) {
    if (points.length < 2) return;
    
    // Рисуем сегменты
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        this.strokeLine(a.x, a.y, b.x, b.y, color, width);
    }
    
    // Если замкнутый — соединяем последнюю с первой
    if (closed && points.length >= 2) {
        const a = points[points.length - 1];
        const b = points[0];
        this.strokeLine(a.x, a.y, b.x, b.y, color, width);
    }
    
    // Круглые стыки только в вершинах, которые реально соединены
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // Не рисуем кап на концах незамкнутой линии
        if (!closed && (i === 0 || i === points.length - 1)) {
            // На концах кап уже нарисован внутри strokeLine
            continue;
        }
        this.fillCircle(p.x, p.y, width / 2, color);
    }
}
}