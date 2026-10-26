import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState } from "./forms.ts";
import { buildScene, render3D, defaultView, orderBoxes } from "./view3d.ts";
import { dividerCount } from "../core/templates.ts";
import type { FurnitureType } from "../core/templates.ts";

const TYPES: FurnitureType[] = ["shkaf", "kupe", "oshxona", "krovat", "divan"];

test("har bir mebel turi uchun 3D sahna va SVG chiqadi", () => {
  for (const type of TYPES) {
    const s = defaultState();
    s.type = type;
    const scene = buildScene(s);
    assert.ok(scene.boxes.length > 4, type);
    for (const b of scene.boxes) {
      assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0, `${type}: bo'sh box`);
      assert.ok(Number.isFinite(b.x0 + b.x1 + b.y0 + b.y1 + b.z0 + b.z1));
    }
    const svg = render3D(s, defaultView());
    assert.ok(svg.startsWith("<svg") && svg.includes("<polygon"), type);
    assert.ok(!svg.includes("NaN"), type);
  }
});

test("shkaf o'lchami sahnada saqlanadi, oyoq balandligi poldan ko'taradi", () => {
  const s = defaultState();
  const sc = buildScene(s);
  const maxX = Math.max(...sc.boxes.map((b) => b.x1));
  const maxY = Math.max(...sc.boxes.map((b) => b.y1));
  assert.equal(maxX, s.params.shkaf.width);
  assert.equal(maxY, s.params.shkaf.height);
  const body = sc.boxes.filter((b) => b.mat === "body");
  assert.equal(Math.min(...body.map((b) => b.y0)), s.params.shkaf.plinth);
});

test("ichini ko'rsatganda javonlar bor, eshiklar yo'q", () => {
  const s = defaultState();
  const closed = buildScene(s);
  const open = buildScene(s, { inside: true });
  assert.ok(closed.boxes.some((b) => b.mat === "door"));
  assert.ok(!open.boxes.some((b) => b.mat === "door"));
  const bodies = (x: typeof open) => x.boxes.filter((b) => b.mat === "body").length;
  const d = dividerCount(s.params.shkaf.width - 2 * s.params.shkaf.thickness, true);
  assert.equal(bodies(open) - bodies(closed), s.params.shkaf.shelves * (d + 1) + d);
});

test("chizish tartibi istalgan burchakda sikl hosil qilmaydi", () => {
  for (const type of TYPES) {
    const s = defaultState();
    s.type = type;
    const svgA = render3D(s, { yaw: 30, pitch: 25 });
    assert.ok(svgA.length > 100);
  }
  const b = [
    { x0: 0, x1: 10, y0: 0, y1: 10, z0: 0, z1: 10, mat: "body" as const },
    { x0: 0, x1: 10, y0: 0, y1: 10, z0: 10, z1: 20, mat: "door" as const },
  ];
  const rect = { x0: 0, x1: 10, y0: 0, y1: 10 };
  const front = orderBoxes(b, [0, 0, 1], [rect, rect]);
  assert.deepEqual(front.order, [0, 1]);
  const back = orderBoxes(b, [0, 0, -1], [rect, rect]);
  assert.deepEqual(back.order, [1, 0]);
});

test("kupe 3D: ruchka yo'q, rels va alyuminiy profil bor, o'rta bokovoy ko'rinadi", () => {
  const s = defaultState();
  s.type = "kupe";
  const sc = buildScene(s);
  assert.ok(!sc.boxes.some((b) => b.mat === "handle"));
  assert.ok(sc.boxes.filter((b) => b.mat === "alu").length >= 2 + 4);
  assert.ok(sc.boxes.filter((b) => b.mat === "body").length >= 4 + 2); // karkas + 2 ta o'rta bokovoy
});
