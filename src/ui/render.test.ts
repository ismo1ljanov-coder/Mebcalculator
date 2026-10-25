import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../core/calculator.ts";
import { buildFor, defaultState } from "./forms.ts";
import type { FurnitureType } from "../core/templates.ts";
import {
  adviceSection,
  cutSection,
  elevationSVG,
  furnitureSection,
  materialSection,
  partsTable,
  summaryCards,
  esc,
} from "./render.ts";

const TYPES: FurnitureType[] = ["shkaf", "kupe", "oshxona", "krovat", "divan"];

test("esc HTML belgilarini almashtiradi", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

for (const type of TYPES) {
  test(`${type}: barcha bo'limlar xatosiz render bo'ladi va SVG to'g'ri yopilgan`, () => {
    const state = defaultState();
    state.type = type;
    state.prices.sheetByThickness = { 16: 300000, 18: 350000 };
    state.prices.edgePerMeter = 2000;
    state.prices.backPanelSheet = 120000;
    state.prices.labor = { mode: "percent", value: 30 };
    const build = buildFor(state);
    const calc = calculate(build, state.sheet, state.prices);
    const dims = { length: state.sheet.length, width: state.sheet.width, trim: state.sheet.trim };

    const html = [
      summaryCards(calc, dims.length * dims.width),
      partsTable(build.parts),
      cutSection(calc, dims, build.parts),
      materialSection(calc, state.sheet, state),
      furnitureSection(build),
      adviceSection(calc, build),
      elevationSVG(state),
    ];
    for (const h of html) {
      assert.ok(h.length > 20);
      assert.ok(!h.includes("NaN"), "NaN chiqdi: " + h.slice(0, 200));
      assert.ok(!h.includes("undefined"), "undefined chiqdi: " + h.slice(0, 200));
    }
    for (const h of [html[2], html[6]]) {
      const open = (h.match(/<svg/g) ?? []).length;
      const close = (h.match(/<\/svg>/g) ?? []).length;
      assert.equal(open, close);
    }
    assert.ok(calc.cost.total > 0);
  });
}

test("narx kiritilmasa, material bo'limi ogohlantiradi", () => {
  const state = defaultState();
  const build = buildFor(state);
  const calc = calculate(build, state.sheet, state.prices);
  assert.ok(materialSection(calc, state.sheet, state).includes("Narxlar kiritilmagan"));
});
