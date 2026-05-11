import { Shape } from "./Shape";
import { Bounds } from "./types";
import { RasterRenderer } from "../raster/RasterRenderer";

export class Line extends Shape {
  dx: number; // смещение от центра до конечной точки
  dy: number;

  constructor(x1: number, y1: number, x2: number, y2: number, props: Partial<Line> = {}) {
    super(props);
    // 7: Храним линию относительно середины
    const localCenterX  = (x1 + x2) / 2;
    const localCenterY = (y1 + y2) / 2;
    this.dx = x2 - localCenterX;
    this.dy = y2 - localCenterY;

    if (props.transform?.x === undefined) {
    this.transform.x = localCenterX;
    }

    if (props.transform?.y === undefined) {
    this.transform.y = localCenterY;
    }
  }

  // 7: Локальные границы
  getLocalBounds(): Bounds {
    return {
      minX: -Math.abs(this.dx),
      minY: -Math.abs(this.dy),
      maxX: Math.abs(this.dx),
      maxY: Math.abs(this.dy),
    };
  }

  // 7: Две конечные точки
  getLocalDevicePoints(): { x: number; y: number }[] {
    const a = this.transformPointToDevice(-this.dx, -this.dy);
    const b = this.transformPointToDevice(this.dx, this.dy);
    return [{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }];
  }

  // Отрисовка через strokeLine из Lab 4
  drawRaster(r: RasterRenderer): void {
    const [ax, ay] = this.transformPointToDevice(-this.dx, -this.dy);
    const [bx, by] = this.transformPointToDevice(this.dx, this.dy);
    const color = this.hexToRGBA(this.strokeStyle);
    color.a = Math.floor(this.strokeOpacity * 255);
    r.strokeLine(ax, ay, bx, by, color, this.strokeWidth);
  }

  // 10.3: Проверка попадания (расстояние от точки до отрезка)
  hitTest(px: number, py: number): boolean {
    const [lx, ly] = this.transformPointToLocal(px, py);
    const ax = -this.dx;
    const ay = -this.dy;
    const bx = this.dx;
    const by = this.dy;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      // Точка совпадает с началом отрезка
      return Math.hypot(lx - ax, ly - ay) <= this.strokeWidth / 2;
    }

    // Проекция точки на отрезок
    let t = ((lx - ax) * dx + (ly - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const dist = Math.hypot(lx - projX, ly - projY);

    return dist <= this.strokeWidth / 2;
  }

  clone(): Shape {
    return new Line(-this.dx, -this.dy, this.dx, this.dy, {
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    });
  }

  toJSON() {
    return {
      type: "Line",
      dx: this.dx,
      dy: this.dy,
      transform: this.transform,
      strokeStyle: this.strokeStyle,
    };
  }
}