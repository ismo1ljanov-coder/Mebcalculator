import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "./app.ts";
import { buildFor, defaultState } from "./forms.ts";
import { calculate } from "../core/calculator.ts";

test("normalizeState: bo'sh yoki yaroqsiz kirish standart holatni beradi", () => {
  for (const bad of [null, undefined, 5, "x", [], {}]) {
    const s = normalizeState(bad);
    assert.equal(s.type, "shkaf");
    assert.equal(s.params.shkaf.width, 1200);
  }
});

test("normalizeState: sonlar chegaralanadi, noma'lum qiymatlar tashlanadi", () => {
  const s = normalizeState({
    type: "yo'q-tur",
    title: "x".repeat(200),
    params: { shkaf: { width: 999999, height: -5, doors: "ikki", legType: "uchar", plinth: 9999, thickness: 7 } },
    sheet: { kerf: 99 },
    prices: { sheetByThickness: { 16: 123 }, labor: { mode: "bad" } },
  });
  assert.equal(s.type, "shkaf");
  assert.equal(s.title.length, 60);
  assert.equal(s.params.shkaf.width, 4000);
  assert.equal(s.params.shkaf.height, 300);
  assert.equal(s.params.shkaf.doors, 2); // matn emas, standart qoladi
  assert.equal(s.params.shkaf.legType, "yoq");
  assert.equal(s.params.shkaf.plinth, 250);
  assert.equal(s.params.shkaf.thickness, 16);
  assert.equal(s.sheet.kerf, 10);
  assert.equal(s.prices.sheetByThickness[16], 123);
  assert.equal(s.prices.labor.mode, "percent");
});

test("normalizeState: eski (v1) saqlangan holat ham ishlaydi va hisoblanadi", () => {
  const old = { type: "oshxona", params: { oshxona: { modules: [{ kind: "past", width: 600, doors: 1, drawers: 0, shelves: 1 }, { bad: 1 }] } } };
  const s = normalizeState(old);
  assert.equal(s.params.oshxona.modules.length, 2);
  const c = calculate(buildFor(s), s.sheet, s.prices);
  assert.ok(c.groups.length > 0);
});

test("normalizeState: to'liq aylanish (JSON) holatni o'zgartirmaydi", () => {
  const d = defaultState();
  const s = normalizeState(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(s, d);
});
