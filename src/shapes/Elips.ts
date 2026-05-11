import { Shape } from "./Shape";
import { Bounds } from "./types";
import { RasterRenderer } from "../raster/RasterRenderer";

export class Oval extends Shape {
  rx: number; // радиус по X
  ry: number; // радиус по Y

  constructor(rx: number, ry: number, props: Partial<Oval> = {}) {
    super(props);
    this.rx = rx;
    this.ry = ry;
  }

  // 8: Локальные границы эллипса
  getLocalBounds(): Bounds {
    return {
      minX: -this.rx,
      minY: -this.ry,
      maxX: this.rx,
      maxY: this.ry,
    };
  }

  // 8: Точки эллипса через параметрическое уравнение
  getLocalDevicePoints(): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const steps = 60; // количество точек для аппроксимации

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const lx = this.rx * Math.cos(angle);
      const ly = this.ry * Math.sin(angle);
      const [dx, dy] = this.transformPointToDevice(lx, ly);
      pts.push({ x: dx, y: dy });
    }

    return pts;
  }

  // Отрисовка через fillPolygon + strokePolygon из Lab 4
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

  // 10.4: Проверка попадания по уравнению эллипса
  hitTest(px: number, py: number): boolean {
    const [lx, ly] = this.transformPointToLocal(px, py);
    const normalized =
      Math.pow(lx / this.rx, 2) + Math.pow(ly / this.ry, 2);
    return normalized <= 1;
  }

  clone(): Shape {
    return new Oval(this.rx, this.ry, {
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
      type: "Oval",
      rx: this.rx,
      ry: this.ry,
      transform: this.transform,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
    };
  }
}