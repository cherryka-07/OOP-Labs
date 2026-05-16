import { describe, test, expect } from 'vitest';
import { Triangle } from './Triangle';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';
import { PathBezier } from './PathBezier';

function approx(p: { x: number; y: number }, x: number, y: number, eps = 1e-2) {
    expect(Math.abs(p.x - x)).toBeLessThan(eps);
    expect(Math.abs(p.y - y)).toBeLessThan(eps);
}

describe('Lab 6 — Shapes (matrix coverage)', () => {
    // 9.1 HitTest для каждой фигуры
    describe('9.1 HitTest', () => {
        test('Triangle: in/out/edge', () => {
            const f = new Triangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
            expect(f.hitTest(50, 35)).toBe(true);
            expect(f.hitTest(50, 150)).toBe(false);
            expect(f.hitTest(50, 0)).toBe(true);
        });

        test('QuadraticBezier: near/far', () => {
            const f = new QuadraticBezier(
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
                { strokeWidth: 4 },
            );
            expect(f.hitTest(50, 48)).toBe(true);
            expect(f.hitTest(50, 200)).toBe(false);
        });

        test('CubicBezier: near/far', () => {
            const f = new CubicBezier(
                { x: 0, y: 0 },
                { x: 30, y: 100 },
                { x: 70, y: -100 },
                { x: 100, y: 0 },
                { strokeWidth: 4 },
            );
            expect(f.hitTest(50, 3)).toBe(true);
            expect(f.hitTest(50, 150)).toBe(false);
        });

        test('PathBezier: hitTest во всех режимах', () => {
            const pts = [
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
            ];
            expect(new PathBezier(pts, { mode: 'quadratic', strokeWidth: 4 }).hitTest(25, 45)).toBe(
                true,
            );

            const cubicPts = [
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
                { x: 150, y: 0 },
            ];
            const cubic = new PathBezier(cubicPts, { mode: 'cubic', strokeWidth: 4 });
            expect(cubic.hitTest(0, 0)).toBe(true);
            expect(cubic.hitTest(150, 0)).toBe(true);

            expect(new PathBezier(pts, { mode: 'catmull', strokeWidth: 4 }).hitTest(50, 100)).toBe(
                true,
            );
        });
    });

    // 9.2 Bounds для каждой фигуры

    describe('9.2 Bounds', () => {
        test('Triangle: valid & contains vertices', () => {
            const f = new Triangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
            const b = f.getBounds();
            const pts = f.getLocalDevicePoints();
            expect(b.minX <= b.maxX && b.minY <= b.maxY).toBe(true);
            for (const p of pts) {
                expect(p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY).toBe(true);
            }
        });

        test('QuadraticBezier: bounds contain approximation', () => {
            const f = new QuadraticBezier({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 });
            const b = f.getBounds();
            const pts = f.flattenDevicePoints();
            for (const p of pts) {
                expect(p.x >= b.minX && p.y >= b.minY).toBe(true);
            }
        });

        test('CubicBezier: bounds account for control points', () => {
            const f = new CubicBezier(
                { x: 0, y: 0 },
                { x: 30, y: 100 },
                { x: 70, y: -100 },
                { x: 100, y: 0 },
            );
            const b = f.getBounds();
            expect(b.minY < 0 && b.maxY > 0).toBe(true);
        });

        test('PathBezier: bounds for all modes', () => {
            const pts = [
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
                { x: 150, y: 100 },
            ];
            (['quadratic', 'cubic', 'catmull'] as const).forEach((mode) => {
                const b = new PathBezier(pts, { mode }).getBounds();
                expect(b.minX <= b.maxX && b.minY <= b.maxY).toBe(true);
            });
        });
    });

    // 9.3 Curves + control points

    describe('9.3 Curves', () => {
        test('Triangle: vertices accessible', () => {
            const f = new Triangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
            expect(f.points).toHaveLength(3);
        });

        test('QuadraticBezier: evalLocal endpoints + midpoint', () => {
            const f = new QuadraticBezier({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 });
            const [sx, sy] = f.transformPointToDevice(f.evalLocal(0).x, f.evalLocal(0).y);
            const [ex, ey] = f.transformPointToDevice(f.evalLocal(1).x, f.evalLocal(1).y);
            const [mx, my] = f.transformPointToDevice(f.evalLocal(0.5).x, f.evalLocal(0.5).y);
            approx({ x: sx, y: sy }, 0, 0, 0.1);
            approx({ x: ex, y: ey }, 100, 0, 0.1);
            approx({ x: mx, y: my }, 50, 50, 1.0);
        });

        test('CubicBezier: evalLocal endpoints', () => {
            const f = new CubicBezier(
                { x: 0, y: 0 },
                { x: 30, y: 100 },
                { x: 70, y: -100 },
                { x: 100, y: 0 },
            );
            const [sx, sy] = f.transformPointToDevice(f.evalLocal(0).x, f.evalLocal(0).y);
            const [ex, ey] = f.transformPointToDevice(f.evalLocal(1).x, f.evalLocal(1).y);
            approx({ x: sx, y: sy }, 0, 0, 0.1);
            approx({ x: ex, y: ey }, 100, 0, 0.1);
        });

        test('All bezier types: setControlPoint changes shape', () => {
            const qb = new QuadraticBezier({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 });
            const cb = new CubicBezier(
                { x: 0, y: 0 },
                { x: 30, y: 50 },
                { x: 70, y: -50 },
                { x: 100, y: 0 },
            );
            const pb = new PathBezier(
                [
                    { x: 0, y: 0 },
                    { x: 50, y: 50 },
                    { x: 100, y: 0 },
                ],
                { mode: 'quadratic' },
            );

            const qbMid = qb.evalLocal(0.5).y;
            qb.setControlPoint(1, { x: 50, y: 150 });
            expect(qb.evalLocal(0.5).y).toBeGreaterThan(qbMid);

            const cbMid = cb.evalLocal(0.5).y;
            cb.setControlPoint(1, { x: 30, y: 150 });
            expect(cb.evalLocal(0.5).y).toBeGreaterThan(cbMid);

            pb.setControlPoint(1, { x: 50, y: 150 });
            expect(pb.getControlPoints()[1].y).toBe(150);
        });

        test('PathBezier: add/remove points', () => {
            const f = new PathBezier(
                [
                    { x: 0, y: 0 },
                    { x: 50, y: 50 },
                ],
                { mode: 'quadratic' },
            );
            f.addPointLocal({ x: 100, y: 0 });
            expect(f.getControlPoints()).toHaveLength(3);
            f.removePoint(1);
            expect(f.getControlPoints()).toHaveLength(2);
        });
    }); // ← закрывает 9.3 Curves

    // 9.4 Serialization для каждой фигуры

    describe('9.4 Serialization', () => {
        test('Triangle: toJSON + clone', () => {
            const f = new Triangle(
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 50, y: 100 },
                {
                    fillStyle: '#F00',
                    transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
                },
            );
            const j = f.toJSON();
            expect(j.type).toBe('Triangle');
            expect(j.fillStyle).toBe('#F00');
            expect(j.transform.x).toBe(10);

            const c = f.clone() as Triangle;
            f.points[0].x = 999;
            expect(c.points[0].x).not.toBe(999);
        });

        test('QuadraticBezier: toJSON preserves world coords', () => {
            const f = new QuadraticBezier(
                { x: 0, y: 0 },
                { x: 50, y: 100 },
                { x: 100, y: 0 },
                { strokeStyle: '#ABC', strokeWidth: 3 },
            );
            const j = f.toJSON();
            expect(j.type).toBe('QuadraticBezier');
            expect(j.p0.x).toBeCloseTo(0, 1);
            expect(j.p2.x).toBeCloseTo(100, 1);
            expect(j.strokeStyle).toBe('#ABC');
        });

        test('CubicBezier: toJSON has 4 control points', () => {
            const f = new CubicBezier(
                { x: 0, y: 0 },
                { x: 30, y: 100 },
                { x: 70, y: -100 },
                { x: 100, y: 0 },
            );
            const j = f.toJSON();
            expect(j.type).toBe('CubicBezier');
            expect([j.p0, j.p1, j.p2, j.p3].every((p) => p && typeof p.x === 'number')).toBe(true);
        });

        test('PathBezier: toJSON preserves mode+anchors+closed', () => {
            const f = new PathBezier(
                [
                    { x: 0, y: 0 },
                    { x: 50, y: 100 },
                ],
                { mode: 'catmull', closed: true, strokeStyle: '#123' },
            );
            const j = f.toJSON();
            expect(j.type).toBe('PathBezier');
            expect(j.mode).toBe('catmull');
            expect(j.closed).toBe(true);
            expect(j.anchors).toHaveLength(2);
            expect(j.strokeStyle).toBe('#123');
        });

        test('All types: clone is independent', () => {
            const figures = [
                new Triangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }),
                new QuadraticBezier({ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }),
                new CubicBezier(
                    { x: 0, y: 0 },
                    { x: 30, y: 100 },
                    { x: 70, y: -100 },
                    { x: 100, y: 0 },
                ),
                new PathBezier(
                    [
                        { x: 0, y: 0 },
                        { x: 50, y: 50 },
                    ],
                    { mode: 'quadratic' },
                ),
            ];
            for (const fig of figures) {
                const c = fig.clone();
                expect(c).toBeDefined();
            }
        });
    });
});
