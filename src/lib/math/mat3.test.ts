import { test, expect } from "vitest";
import { mat3, type Mat3 } from "./mat3";
function expectMatCloseTo(actual: Mat3, expected: Mat3, eps = 1e-9) {
for (let i = 0; i < 9; i++) {
expect(actual[i]).toBeCloseTo(expected[i], Math.log10(1 / eps));
}
}
function expectAffine(m: Mat3) {
expect(m[6]).toBeCloseTo(0);
expect(m[7]).toBeCloseTo(0);
expect(m[8]).toBeCloseTo(1);
}
test("identity: full matrix", () => {
const I = mat3.identity();
const expected: Mat3 = [1,0,0, 0,1,0, 0,0,1];
expectMatCloseTo(I, expected);
expectAffine(I);
});
test("translate: exact matrix and transformPoint", () => {
const tx = 10, ty = -5;
const T = mat3.translate(tx, ty);
const expected: Mat3 = [1,0,tx, 0,1,ty, 0,0,1];
expectMatCloseTo(T, expected);
expectAffine(T);
const p = mat3.transformPoint(T, 3, 4);
expect(p.x).toBeCloseTo(3 + tx);
expect(p.y).toBeCloseTo(4 + ty);
});
test("scale: exact matrix and point behavior", () => {
const sx = 2, sy = 0.5;
const S = mat3.scale(sx, sy);
const expected: Mat3 = [sx,0,0, 0,sy,0, 0,0,1];
expectMatCloseTo(S, expected);
expectAffine(S);
const p = mat3.transformPoint(S, 4, 6);
expect(p.x).toBeCloseTo(4 * sx);

expect(p.y).toBeCloseTo(6 * sy);
});
test("rotate: 0 and 90 degrees (explicit expected values)", () => {
const r0 = mat3.rotate(0);
expectMatCloseTo(r0, mat3.identity());
expectAffine(r0);
const angle = Math.PI / 2;
const r90 = mat3.rotate(angle);
const expected90: Mat3 = [Math.cos(angle), -Math.sin(angle), 0,
Math.sin(angle),  Math.cos(angle), 0,
0, 0, 1];
expectMatCloseTo(r90, expected90);
expectAffine(r90);
const p = mat3.transformPoint(r90, 1, 0);
expect(p.x).toBeCloseTo(0);
expect(p.y).toBeCloseTo(1);
});
test("fromTransform: behavior equals scale->rotate->translate applied to a point", () => {
const tx = 100, ty = 50, angle = Math.PI/4, sx = 2, sy = 1;
const M = mat3.fromTransform(tx, ty, angle, sx, sy);
const local = { x: 1, y: 0 };
const scaled = { x: local.x * sx, y: local.y * sy };
const rotated = {
x: scaled.x * Math.cos(angle) - scaled.y * Math.sin(angle),
y: scaled.x * Math.sin(angle) + scaled.y * Math.cos(angle)
};
const translated = { x: rotated.x + tx, y: rotated.y + ty };
const pFromM = mat3.transformPoint(M, local.x, local.y);
expect(pFromM.x).toBeCloseTo(translated.x);
expect(pFromM.y).toBeCloseTo(translated.y);
expectAffine(M);
});
test("multiply: black-box property using points (A*B acting like A after B)", () => {

const A = mat3.fromTransform(5, 7, 0.2, 1.5, 0.8);
const B = mat3.fromTransform(-3, 2, Math.PI/6, 0.5, 2);
const points = [
{x:0,y:0}, {x:1,y:0}, {x:0,y:1}, {x:2.3,y:-1.7}, {x:-4.1,y:3.2}
];
for (const pt of points) {
const AB = mat3.multiply(A, B);
const p1 = mat3.transformPoint(AB, pt.x, pt.y);
const pB = mat3.transformPoint(B, pt.x, pt.y);
const p2 = mat3.transformPoint(A, pB.x, pB.y);
expect(p1.x).toBeCloseTo(p2.x);
expect(p1.y).toBeCloseTo(p2.y);
}
const I = mat3.identity();
expectMatCloseTo(mat3.multiply(A, I), A);
expectMatCloseTo(mat3.multiply(I, A), A);
});
test("invert: round-trip of points and degenerate cases", () => {
const cases = [
{tx:0, ty:0, r:0, sx:1, sy:1},
{tx:10, ty:20, r:0.5, sx:2, sy:3},
{tx:-5, ty:4, r:-0.8, sx:0.7, sy:0.9},
];
for (const c of cases) {
const M = mat3.fromTransform(c.tx, c.ty, c.r, c.sx, c.sy);
const inv = mat3.invert(M);
expect(inv).not.toBeNull();
if (!inv) continue;
const pts = [{x:0,y:0}, {x:1,y:2}, {x:-3.3,y:4.4}];
for (const p of pts) {
const pDev = mat3.transformPoint(M, p.x, p.y);
const pBack = mat3.transformPoint(inv, pDev.x, pDev.y);
expect(pBack.x).toBeCloseTo(p.x);
expect(pBack.y).toBeCloseTo(p.y);
}
}
expect(mat3.invert(mat3.scale(0, 1))).toBeNull();
expect(mat3.invert(mat3.scale(1, 0))).toBeNull();
});
test("randomized sanity: transformPoint matches manual steps for many deterministic cases", () => {
for (let i = 0; i < 30; i++) {
const tx = (i % 7) - 3;
const ty = ((i * 3) % 11) - 5;
const angle = (i * 0.37) % (2*Math.PI);
const sx = 0.2 + ((i % 5) * 0.6);
const sy = 0.3 + ((i % 3) * 0.8);
const M = mat3.fromTransform(tx, ty, angle, sx, sy);
const px = (i % 5) - 2.5;
const py = ((i * 2) % 7) - 3.5;
const pFromM = mat3.transformPoint(M, px, py);
const scaled = { x: px * sx, y: py * sy };
const rotated = {
x: scaled.x * Math.cos(angle) - scaled.y * Math.sin(angle),
y: scaled.x * Math.sin(angle) + scaled.y * Math.cos(angle),
};
const manual = { x: rotated.x + tx, y: rotated.y + ty };
expect(pFromM.x).toBeCloseTo(manual.x);
expect(pFromM.y).toBeCloseTo(manual.y);
expectAffine(M);
}
});
