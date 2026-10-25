import { test } from "node:test";
import assert from "node:assert/strict";
import { packParts } from "./binPacking.ts";
import { edgeLengthMeters } from "./edge.ts";
import type { Part, Sheet, Placement } from "./types.ts";

const SHEET: Sheet = { length: 2750, width: 1830, thickness: 16, kerf: 4, trim: 0 };
const noEdge = { L1: false, L2: false, W1: false, W2: false };

function part(id: string, length: number, width: number, qty = 1, grain = false): Part {
  return { id, name: id, length, width, qty, thickness: 16, grain, edge: noEdge };
}

function overlaps(a: Placement, b: Placement) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

test("bitta detal: foydalanish foizi to'g'ri hisoblanadi", () => {
  const r = packParts([part("a", 1000, 500)], SHEET);
  assert.equal(r.sheets.length, 1);
  assert.equal(r.unplaced.length, 0);
  const expected = (1000 * 500) / (2750 * 1830) * 100;
  assert.ok(Math.abs(r.utilization - expected) < 1e-9);
  assert.ok(Math.abs(r.utilization + r.waste - 100) < 1e-9);
});

test("tekstura yo'nalishi: aylantirib bo'lmaydigan detal sig'masa, joylashtirilmaydi", () => {
  // 1800 (uzunlik) x 2600 (en): list eni 1830 dan katta, aylantirsak sig'adi
  const free = packParts([part("a", 1800, 2600, 1, false)], SHEET);
  assert.equal(free.unplaced.length, 0);
  assert.equal(free.sheets[0].placements[0].rotated, true);

  const grain = packParts([part("a", 1800, 2600, 1, true)], SHEET);
  assert.equal(grain.unplaced.length, 1);
  assert.equal(grain.sheets.length, 0);
});

test("tekstura detali hech qachon aylantirilmaydi", () => {
  const parts = [part("g", 700, 400, 6, true), part("h", 500, 300, 6, true)];
  const r = packParts(parts, SHEET);
  assert.equal(r.unplaced.length, 0);
  for (const s of r.sheets) for (const p of s.placements) assert.equal(p.rotated, false);
});

test("detallar ustma-ust tushmaydi, list ichida, kerf saqlanadi", () => {
  const parts = [
    part("yon", 2200, 550, 2),
    part("tepa", 900, 550, 2),
    part("javon", 864, 520, 5),
    part("eshik", 2100, 448, 4),
    part("kichik", 300, 120, 12),
  ];
  const r = packParts(parts, SHEET);
  assert.equal(r.unplaced.length, 0);

  const total = parts.reduce((s, p) => s + p.qty, 0);
  assert.equal(
    r.sheets.reduce((s, x) => s + x.placements.length, 0),
    total,
  );

  for (const s of r.sheets) {
    for (const p of s.placements) {
      assert.ok(p.x >= SHEET.trim && p.y >= SHEET.trim);
      assert.ok(p.x + p.w <= SHEET.length - SHEET.trim);
      assert.ok(p.y + p.h <= SHEET.width - SHEET.trim);
    }
    for (let i = 0; i < s.placements.length; i++) {
      for (let j = i + 1; j < s.placements.length; j++) {
        assert.ok(!overlaps(s.placements[i], s.placements[j]), "ustma-ust tushdi");
      }
    }
  }
});

test("kerf: ikkita detal orasida kamida kerf masofa bor", () => {
  // Ikkita 1375 mm detal 2750 listga kerf bilan sig'maydi (1375*2 + 4 > 2750)
  const r = packParts([part("a", 1375, 1830, 2)], SHEET);
  assert.equal(r.sheets.length, 2, "kerfsiz hisoblansa 1 listga sig'ib qolardi");

  // 1373 + 4 + 1373 = 2750 — aynan sig'adi
  const ok = packParts([part("a", 1373, 1830, 2)], SHEET);
  assert.equal(ok.sheets.length, 1);
  const [p, q] = ok.sheets[0].placements;
  const gap = Math.abs(p.x - q.x) - Math.min(p.w, q.w);
  assert.ok(gap >= SHEET.kerf);
});

test("trim: list chetidan qirra olib tashlanadi", () => {
  const trimmed: Sheet = { ...SHEET, trim: 10 };
  // 2750 - 20 = 2730 dan uzun detal sig'maydi
  const r = packParts([part("a", 2740, 100)], trimmed);
  assert.equal(r.unplaced.length, 1);
  const ok = packParts([part("a", 2730, 100)], trimmed);
  assert.equal(ok.unplaced.length, 0);
});

test("ko'p list kerak bo'lsa, listlar soni to'g'ri", () => {
  // Har biri 1800x1200, ikkitasi bir listga sig'maydi (1830 dan baland)
  const r = packParts([part("a", 1800, 1200, 3)], SHEET);
  assert.ok(r.sheets.length >= 2);
  assert.equal(r.unplaced.length, 0);
});

test("kant uzunligi metrda to'g'ri", () => {
  const p: Part = {
    ...part("a", 800, 400, 2),
    edge: { L1: true, L2: false, W1: true, W2: false },
  };
  const e = edgeLengthMeters([p], 0.1);
  // (800 + 400) * 2 = 2400 mm = 2.4 m
  assert.ok(Math.abs(e.net - 2.4) < 1e-9);
  assert.ok(Math.abs(e.withWaste - 2.64) < 1e-9);
});

test("aniq 2x2 bo'linma: 4 ta detal bir listga sig'adi (kerf bilan)", () => {
  // 1363*2 + 4 = 2730 <= 2750, 903*2 + 4 = 1810 <= 1830
  const r = packParts([part("a", 1363, 903, 4)], SHEET);
  assert.equal(r.sheets.length, 1);
  assert.equal(r.unplaced.length, 0);
});

test("natija deterministik: bir xil kirish bir xil chiqish", () => {
  const parts = [part("a", 1200, 600, 3), part("b", 800, 400, 5), part("c", 2000, 300, 2, true)];
  const r1 = JSON.stringify(packParts(parts, SHEET).sheets);
  const r2 = JSON.stringify(packParts(parts, SHEET).sheets);
  assert.equal(r1, r2);
});
