import { describe, test, expect } from "vitest";
import { Rect, Line, Oval } from ".";

describe("Shape hitTest & bounds", () => {
  test("Rect hitTest - точка внутри", () => {
    const rect = new Rect(100, 50, {
      transform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(rect.hitTest(100, 50)).toBe(true); // центр
    expect(rect.hitTest(140, 70)).toBe(true); // угол
  });

  test("Rect hitTest - точка снаружи", () => {
    const rect = new Rect(100, 50, {
      transform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(rect.hitTest(151, 50)).toBe(false); // за правой границей
    expect(rect.hitTest(100, 76)).toBe(false); // за нижней границей
  });

  test("Oval hitTest - точка внутри эллипса", () => {
    const oval = new Oval(100, 50, {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(oval.hitTest(50, 25)).toBe(true); // (0.5²+0.5²=0.5 ≤ 1)
    expect(oval.hitTest(0, 0)).toBe(true); // центр
  });

  test("Oval hitTest - точка снаружи эллипса", () => {
    const oval = new Oval(100, 50, {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(oval.hitTest(120, 60)).toBe(false); // (1.2²+1.2²=2.88 > 1)
  });

  test("Line bounds", () => {
    const line = new Line(0, 0, 100, 0, {
      transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    const b = line.getBounds();
    expect(b.minX).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(100);
  });

  test("Rect getBounds", () => {
    const rect = new Rect(100, 50, {
      transform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    const b = rect.getBounds();
    expect(b.minX).toBeCloseTo(50);
    expect(b.maxX).toBeCloseTo(150);
    expect(b.minY).toBeCloseTo(25);
    expect(b.maxY).toBeCloseTo(75);
  });
});