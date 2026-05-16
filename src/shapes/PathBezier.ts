import { Shape } from './Shape';
import { Bounds } from './types';
import { RasterRenderer } from '../raster/RasterRenderer';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';

type Point = { x: number; y: number };
type PathMode = 'quadratic' | 'cubic' | 'catmull'; // ← добавлен режим 'catmull'

export class PathBezier extends Shape {
    // anchors хранятся в МИРОВЫХ координатах (упрощение для составного пути)
    anchors: Point[];
    closed: boolean;
    mode: PathMode;

    // Константа для согласованной аппроксимации
    private readonly APPROX_STEPS = 64;

    // Коэффициент натяжения для Catmull-Rom (стандартное значение 0.5)
    private readonly CATMULL_TENSION = 0.5;

    constructor(anchors: Point[], props: Partial<PathBezier> & { mode?: PathMode } = {}) {
        super(props);

        // Глубокая копия якорей (мировые координаты)
        this.anchors = anchors.map((p) => ({ ...p }));
        this.closed = props.closed ?? false;
        this.mode = props.mode ?? 'quadratic';
    }

    //  Преобразование сегмента Catmull-Rom в кубическую Безье
    // Для точек [P0, P1, P2, P3] строит сегмент от P1 до P2
    private catmullToCubic(p0: Point, p1: Point, p2: Point, p3: Point): CubicBezier {
        // Формула преобразования Catmull-Rom → Cubic Bézier:
        // B0 = P1 (начало)
        // B3 = P2 (конец)
        // B1 = P1 + (P2 - P0) * tension / 3
        // B2 = P2 - (P3 - P1) * tension / 3
        const tension = this.CATMULL_TENSION;

        const b0 = { ...p1 };
        const b3 = { ...p2 };
        const b1 = {
            x: p1.x + ((p2.x - p0.x) * tension) / 3,
            y: p1.y + ((p2.y - p0.y) * tension) / 3,
        };
        const b2 = {
            x: p2.x - ((p3.x - p1.x) * tension) / 3,
            y: p2.y - ((p3.y - p1.y) * tension) / 3,
        };

        return new CubicBezier(b0, b1, b2, b3);
    }

    //  Строит массив кривых из опорных точек в зависимости от режима
    private buildCurves(): (QuadraticBezier | CubicBezier)[] {
        const curves: (QuadraticBezier | CubicBezier)[] = [];

        if (this.anchors.length < 2) return curves;

        if (this.mode === 'quadratic') {
            // Квадратичные сегменты: каждые 3 точки → 1 кривая, шаг 2
            if (this.anchors.length < 3) return curves;
            for (let i = 0; i <= this.anchors.length - 3; i += 2) {
                curves.push(
                    new QuadraticBezier(this.anchors[i], this.anchors[i + 1], this.anchors[i + 2]),
                );
            }
        } else if (this.mode === 'cubic') {
            // Кубические сегменты: каждые 4 точки → 1 кривая, шаг 3
            if (this.anchors.length < 4) return curves;
            for (let i = 0; i <= this.anchors.length - 4; i += 3) {
                curves.push(
                    new CubicBezier(
                        this.anchors[i],
                        this.anchors[i + 1],
                        this.anchors[i + 2],
                        this.anchors[i + 3],
                    ),
                );
            }
        } else if (this.mode === 'catmull') {
            // Catmull-Rom: строим кубические Безье для каждого сегмента [P1→P2]
            // с использованием соседних точек [P0] и [P3] для гладкости
            if (this.anchors.length < 4) {
                // Для <4 точек строим простую ломаную как fallback
                for (let i = 0; i < this.anchors.length - 1; i++) {
                    curves.push(
                        new CubicBezier(
                            this.anchors[i],
                            this.anchors[i], // контрольные точки совпадают с концами → прямая
                            this.anchors[i + 1],
                            this.anchors[i + 1],
                        ),
                    );
                }
                return curves;
            }

            for (let i = 0; i < this.anchors.length - 3; i++) {
                const p0 = this.anchors[i];
                const p1 = this.anchors[i + 1];
                const p2 = this.anchors[i + 2];
                const p3 = this.anchors[i + 3];

                curves.push(this.catmullToCubic(p0, p1, p2, p3));
            }

            // Обработка замкнутого пути: добавляем сегменты для соединения конца с началом
            if (this.closed && this.anchors.length >= 4) {
                const n = this.anchors.length;
                // Сегмент: предпоследняя → последняя → первая → вторая
                curves.push(
                    this.catmullToCubic(
                        this.anchors[n - 2],
                        this.anchors[n - 1],
                        this.anchors[0],
                        this.anchors[1],
                    ),
                );
                // Сегмент: последняя → первая → вторая → третья
                curves.push(
                    this.catmullToCubic(
                        this.anchors[n - 1],
                        this.anchors[0],
                        this.anchors[1],
                        this.anchors[2],
                    ),
                );
            }
        }

        return curves;
    }

    //  Возвращает все точки аппроксимации в экранных координатах
    getAllPoints(): Point[] {
        const curves = this.buildCurves();
        const pts: Point[] = [];

        for (const curve of curves) {
            const curvePts = curve.flattenDevicePoints(this.APPROX_STEPS);
            // Пропускаем первую точку, если это не первый сегмент (избегаем дубликатов)
            if (pts.length > 0 && curvePts.length > 0) {
                curvePts.shift();
            }
            pts.push(...curvePts);
        }

        // Для замкнутого пути добавляем соединение последней точки с первой
        if (this.closed && pts.length > 1) {
            pts.push({ ...pts[0] });
        }

        return pts;
    }

    getLocalDevicePoints(): Point[] {
        return this.getAllPoints();
    }

    //  Границы в экранных координатах
    // Примечание: для PathBezier локальные координаты = мировые (anchors хранятся в мировых)
    getLocalBounds(): Bounds {
        const pts = this.getAllPoints();
        if (pts.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
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
        return this.getLocalBounds(); // для PathBezier совпадают
    }

    //  Возвращает опорные точки в МИРОВЫХ координатах
    getControlPoints(): Point[] {
        return this.anchors.map((p) => ({ ...p }));
    }

    //  Устанавливает опорную точку в МИРОВЫХ координатах
    setControlPoint(idx: number, pt: Point): void {
        if (idx >= 0 && idx < this.anchors.length) {
            this.anchors[idx] = { ...pt }; // глубокая копия
        }
    }

    //  Добавляет точку в МИРОВЫХ координатах
    addPointLocal(pt: Point, index?: number): void {
        if (index !== undefined && index >= 0 && index <= this.anchors.length) {
            this.anchors.splice(index, 0, { ...pt });
        } else {
            this.anchors.push({ ...pt });
        }
    }

    //  Удаляет точку по индексу
    removePoint(index: number): void {
        if (index >= 0 && index < this.anchors.length) {
            this.anchors.splice(index, 1);
        }
    }

    //  Отрисовка: использует аппроксимированные точки
    drawRaster(r: RasterRenderer): void {
        const pts = this.getAllPoints();
        if (pts.length < 2) return;

        const stroke = this.hexToRGBA(this.strokeStyle);
        stroke.a = Math.floor(this.strokeOpacity * 255);
        r.strokePolygon(pts, stroke, this.strokeWidth, false); // closed обрабатывается в getAllPoints
    }

    //  HitTest: проверка попадания по расстоянию до аппроксимированной ломаной
    hitTest(px: number, py: number): boolean {
        const pts = this.getAllPoints();
        if (pts.length < 2) return false;

        let minDist = Infinity;

        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;

            let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));

            const projX = a.x + t * dx;
            const projY = a.y + t * dy;
            const dist = Math.hypot(px - projX, py - projY);
            minDist = Math.min(minDist, dist);
        }

        // Запас в 2 пикселя на погрешность аппроксимации + мин. порог 4px для удобства
        const tolerance = Math.max(4, (this.strokeWidth || 1) + 2);
        return minDist <= tolerance;
    }

    //  clone(): создаёт независимую копию
    clone(): Shape {
        // PathBezier хранит anchors в мировых координатах, копируем как есть
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

    // toJSON(): сериализация с МИРОВЫМИ координатами
    toJSON() {
        return {
            type: 'PathBezier',
            anchors: this.anchors.map((p) => ({ ...p })), // глубокая копия
            closed: this.closed,
            mode: this.mode,
            transform: { ...this.transform },
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            fillStyle: this.fillStyle, // ← добавлено
            fillOpacity: this.fillOpacity, // ← добавлено
        };
    }

    //  Вспомогательные методы для работы с мировыми координатами (удобство для внешнего кода)
    getControlPointWorld(idx: number): Point | null {
        if (idx < 0 || idx >= this.anchors.length) return null;
        return { ...this.anchors[idx] };
    }

    setControlPointWorld(idx: number, worldPt: Point): void {
        this.setControlPoint(idx, worldPt); // anchors уже в мировых координатах
    }
}
