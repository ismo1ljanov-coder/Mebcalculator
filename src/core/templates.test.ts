import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShkaf,
  buildKupe,
  buildOshxona,
  buildKrovat,
  buildDivan,
  SHKAF_DEFAULT,
  KUPE_DEFAULT,
  OSHXONA_DEFAULT,
  KROVAT_DEFAULT,
  DIVAN_DEFAULT,
  hingesPerDoor,
} from "./templates.ts";
import { calculate, type Prices } from "./calculator.ts";

const PRICES: Prices = {
  sheetByThickness: { 16: 100, 18: 120 },
  edgePerMeter: 10,
  backPanelSheet: 50,
  labor: { mode: "percent", value: 20 },
  marginPercent: 10,
};
const SHEET = { length: 2750, width: 1830, kerf: 4, trim: 10 };

test("sharnir soni balandlikka qarab", () => {
  assert.equal(hingesPerDoor(700), 2);
  assert.equal(hingesPerDoor(1200), 3);
  assert.equal(hingesPerDoor(1900), 4);
  assert.equal(hingesPerDoor(2300), 5);
});

test("shkaf: detallar o'lchami qo'lda hisobga mos", () => {
  // 1200 x 2200 x 550, t=16, 4 javon, 2 eshik
  const r = buildShkaf(SHKAF_DEFAULT);
  const byName = (n: string) => r.parts.find((p) => p.name === n)!;
  const yon = byName("Yon devor");
  assert.deepEqual([yon.length, yon.width, yon.qty], [2200, 550, 2]);
  const tepa = byName("Tepa");
  assert.deepEqual([tepa.length, tepa.width], [1200 - 32, 550]); // 1168
  const javon = byName("Javon");
  // 1200 mm eni, javonli: 1 ta o'rta bokovoy, 2 bo'lim, har biri (1168-16)/2 = 576 mm
  const mid = byName("O'rta bokovoy");
  assert.deepEqual([mid.length, mid.width, mid.qty], [2200 - 32, 550, 1]);
  assert.deepEqual([javon.length, javon.width, javon.qty], [574, 530, 8]);
  const eshik = byName("Eshik");
  // (1200 - 3*3)/2 = 595.5 → 596 (yaxlitlanadi), balandlik 2200 - 6 = 2194
  assert.equal(eshik.length, 2194);
  assert.equal(eshik.width, 595);
  assert.equal(eshik.qty, 2);
  // orqa devor (1196 x 2196) mm² → m²
  assert.ok(Math.abs(r.backPanelM2 - (1196 * 2196) / 1e6) < 1e-9);
  // sharnir: 2194 mm balandlik → 5 ta har eshikka → 10
  const hinge = r.furniture.find((f) => f.name.startsWith("Sharnir (")) !;
  assert.equal(hinge.qty, 10);
});

test("barcha shablonlar hisoblanadi va hech narsa 'sig'maydi' demaydi", () => {
  const builds = [
    buildShkaf(SHKAF_DEFAULT),
    buildKupe(KUPE_DEFAULT),
    buildOshxona(OSHXONA_DEFAULT),
    buildKrovat(KROVAT_DEFAULT),
    buildDivan(DIVAN_DEFAULT),
  ];
  for (const b of builds) {
    assert.ok(b.parts.length > 0);
    const c = calculate(b, SHEET, PRICES);
    const sigmadi = c.warnings.filter((w) => w.includes("sig'maydi"));
    assert.deepEqual(sigmadi, []);
    for (const g of c.groups) {
      assert.ok(g.pack.utilization > 0 && g.pack.utilization <= 100);
      // Joylashtirilgan detallar soni = so'ralgan detallar soni
      const placed = g.pack.sheets.reduce((s, x) => s + x.placements.length, 0);
      assert.equal(placed, g.partsCount);
    }
    assert.ok(c.cost.total > 0);
  }
});

test("narx: tannarx formulasi to'g'ri", () => {
  const b = buildShkaf(SHKAF_DEFAULT);
  const c = calculate(b, SHEET, PRICES);
  const materials = c.cost.ldsp + c.cost.edge + c.cost.backPanel;
  assert.ok(Math.abs(c.cost.labor - materials * 0.2) < 1e-6);
  assert.ok(Math.abs(c.cost.subtotal - materials * 1.2) < 1e-6);
  assert.ok(Math.abs(c.cost.total - materials * 1.2 * 1.1) < 1e-6);
});

test("kupe: eshik eni (rels qoplashi bilan) ichki kenglikka mos", () => {
  const r = buildKupe(KUPE_DEFAULT);
  const e = r.parts.find((p) => p.name.startsWith("Kupe eshik"))!;
  // (1800 - 32 + 30)/2 = 899
  assert.equal(e.width, 899);
  assert.equal(e.qty, 2);
});

test("noto'g'ri katta detal ogohlantirish beradi", () => {
  const huge = buildShkaf({ ...SHKAF_DEFAULT, height: 3200 });
  const c = calculate(huge, SHEET, PRICES);
  assert.ok(c.warnings.some((w) => w.includes("sig'maydi")));
});

// ---------------------------------------------------------------- Oyoq (tsokol / nikel)

test("oyoq 'yoq': plinth qiymati e'tiborga olinmaydi", () => {
  const r = buildShkaf({ ...SHKAF_DEFAULT, legType: "yoq", plinth: 150 });
  assert.equal(r.parts.find((p) => p.name === "Yon devor")!.length, 2200);
  assert.ok(!r.parts.some((p) => p.name.startsWith("Tsokol")));
});

test("tsokol: karkas balandligi kamayadi, tsokol planka va plastik oyoq qo'shiladi", () => {
  const r = buildShkaf({ ...SHKAF_DEFAULT, legType: "tsokol", plinth: 100 });
  assert.equal(r.parts.find((p) => p.name === "Yon devor")!.length, 2100);
  const ts = r.parts.find((p) => p.name.startsWith("Tsokol"))!;
  assert.deepEqual([ts.length, ts.width, ts.qty], [1200, 97, 1]);
  const leg = r.furniture.find((f) => f.name.startsWith("Rostlanadigan oyoq"))!;
  assert.equal(leg.qty, 6); // eni 1200 > 1000: o'rtaga qo'shimcha tayanch
  const narrow = buildShkaf({ ...SHKAF_DEFAULT, width: 900, legType: "tsokol", plinth: 100 });
  assert.equal(narrow.furniture.find((f) => f.name.startsWith("Rostlanadigan oyoq"))!.qty, 4);
  // eshik balandligi: 2100 - 6
  assert.equal(r.parts.find((p) => p.name === "Eshik")!.length, 2094);
  // orqa devor balandligi: 2100 - 4
  assert.ok(Math.abs(r.backPanelM2 - (1196 * 2096) / 1e6) < 1e-9);
});

test("keng shkafda oyoq soni 6 ta", () => {
  const r = buildShkaf({ ...SHKAF_DEFAULT, width: 1500, legType: "tsokol", plinth: 100 });
  assert.equal(r.furniture.find((f) => f.name.startsWith("Rostlanadigan oyoq"))!.qty, 6);
  const n = buildShkaf({ ...SHKAF_DEFAULT, width: 1500, legType: "nikel", plinth: 150 });
  assert.equal(n.furniture.find((f) => f.name.startsWith("Nikel"))!.qty, 6);
});

test("nikel oyoq: tsokol planka yo'q, nikel oyoq va plastinka bor, balandlik kamayadi", () => {
  const r = buildShkaf({ ...SHKAF_DEFAULT, legType: "nikel", plinth: 150 });
  assert.ok(!r.parts.some((p) => p.name.startsWith("Tsokol")));
  assert.equal(r.parts.find((p) => p.name === "Yon devor")!.length, 2050);
  assert.equal(r.furniture.find((f) => f.name.startsWith("Nikel"))!.qty, 6);
  assert.ok(r.furniture.some((f) => f.name.includes("plastinka")));
  assert.ok(r.notes.some((n) => n.includes("Nikel oyoq")));
});

test("kupe: tsokol bilan eshik balandligi oyoqqa mos kamayadi", () => {
  const a = buildKupe({ ...KUPE_DEFAULT, legType: "yoq" });
  const b = buildKupe({ ...KUPE_DEFAULT, legType: "tsokol", plinth: 100 });
  const door = (r: ReturnType<typeof buildKupe>) => r.parts.find((p) => p.name.startsWith("Kupe eshik"))!.length;
  assert.equal(door(a) - door(b), 100);
});

test("oshxona: tsokol -> planka m + plastik oyoq; nikel -> nikel oyoq, planka yo'q", () => {
  const ts = buildOshxona({ ...OSHXONA_DEFAULT, legType: "tsokol" });
  assert.ok(ts.furniture.some((f) => f.name.startsWith("Tsokol planka")));
  // 3 ta pastki modul (600, 800, 600) -> 3*4 = 12 oyoq
  assert.equal(ts.furniture.find((f) => f.name.startsWith("Rostlanadigan oyoq"))!.qty, 12);
  const nk = buildOshxona({ ...OSHXONA_DEFAULT, legType: "nikel", plinth: 150 });
  assert.ok(!nk.furniture.some((f) => f.name.startsWith("Tsokol planka")));
  assert.equal(nk.furniture.find((f) => f.name.startsWith("Nikel"))!.qty, 12);
  const none = buildOshxona({ ...OSHXONA_DEFAULT, legType: "yoq" });
  assert.ok(!none.furniture.some((f) => /oyoq/i.test(f.name)));
});

test("krovat va divan: oyoq turi nomi va balandligi hisobga olinadi", () => {
  const k = buildKrovat({ ...KROVAT_DEFAULT, legType: "nikel", legHeight: 200 });
  const leg = k.furniture.find((f) => f.name.startsWith("Nikel"))!;
  assert.equal(leg.qty, 6); // matras 1600 >= 1400: o'rtada qo'shimcha
  assert.ok(leg.note!.includes("200"));
  const d = buildDivan({ ...DIVAN_DEFAULT, legType: "plastik", legHeight: 100 });
  assert.equal(d.parts.find((p) => p.name.startsWith("Yon"))!.length, 350); // 450 - 100
  assert.ok(d.furniture.some((f) => f.name === "Plastik oyoq"));
});

// ---- Hech narsa qolib ketmasligi (to'liqlik) tekshiruvi
import { dividerCount } from "./templates.ts";

test("o'rta bokovoy qoidasi", () => {
  assert.equal(dividerCount(768, true), 0);
  assert.equal(dividerCount(1168, true), 1); // 1200 mm shkaf, javonli
  assert.equal(dividerCount(1768, true), 2); // 1800 mm kupe, javonli
  assert.equal(dividerCount(1168, false), 0);
  assert.equal(dividerCount(1768, false), 1);
  assert.equal(dividerCount(2368, false), 1);
  assert.equal(dividerCount(2768, false), 2);
});

test("kupe: o'rta bokovoy, shtanga, ruchkasiz eshik profili va relslar hisobda", () => {
  const r = buildKupe(KUPE_DEFAULT);
  assert.ok(r.parts.some((p) => p.name === "O'rta bokovoy" && p.qty === 2));
  assert.ok(r.furniture.some((f) => f.name.startsWith("Shtanga (")));
  assert.ok(!r.furniture.some((f) => f.name === "Ruchka"));
  assert.ok(r.furniture.some((f) => f.name.includes("rels")));
  assert.ok(r.furniture.some((f) => f.name.includes("ramka profili (vertikal)") && f.qty === 4));
  assert.ok(r.notes.some((n) => n.includes("o'rta bokovoy")));
});

test("shkaf/kupe/oshxona/krovat/divan: har bir detal raskroyga joylashadi (soni teng)", () => {
  const builds = [
    buildShkaf({ ...SHKAF_DEFAULT, drawers: 2, rods: 1, legType: "tsokol", plinth: 100 }),
    buildShkaf({ ...SHKAF_DEFAULT, width: 3000, shelves: 5 }),
    buildKupe(KUPE_DEFAULT),
    buildKupe({ ...KUPE_DEFAULT, width: 3000, sliding: 3, legType: "nikel", plinth: 120 }),
    buildOshxona(OSHXONA_DEFAULT),
    buildKrovat({ ...KROVAT_DEFAULT, drawers: 2 }),
    buildDivan(DIVAN_DEFAULT),
  ];
  for (const b of builds) {
    const total = b.parts.reduce((s, p) => s + p.qty, 0);
    const calc = calculate(b, SHEET, PRICES);
    const placed = calc.groups.reduce((s, g) => s + g.pack.sheets.reduce((x, sh) => x + sh.placements.length, 0), 0);
    assert.equal(calc.warnings.filter((w) => w.includes("sig'maydi")).length, 0);
    assert.equal(placed, total, "joylashgan detal soni jami detal soniga teng bo'lishi kerak");
  }
});

test("oshxona: osma planka, tumba biriktirish boltlari va krovat sandiq orqa/taglik bor", () => {
  const o = buildOshxona(OSHXONA_DEFAULT);
  assert.ok(o.parts.some((p) => p.name.includes("Osma planka")));
  assert.ok(o.furniture.some((f) => f.name.startsWith("Tumbalarni biriktiruvchi")));
  const k = buildKrovat({ ...KROVAT_DEFAULT, drawers: 2 });
  assert.ok(k.parts.some((p) => p.name === "Sandiq tortma orqa"));
  assert.ok(k.furniture.some((f) => f.name === "Tortma taglik DVP"));
});

import { sectionPlan, shelfYs } from "./templates.ts";

test("bo'lim rejasi: osma bo'limda javon yo'q, tortma javonli bo'limda pastda", () => {
  const plan = sectionPlan(3, 4, 1, 2);
  assert.deepEqual(plan, [
    { rod: true, shelves: 0, drawers: 0 },
    { rod: false, shelves: 4, drawers: 2 },
    { rod: false, shelves: 4, drawers: 0 },
  ]);
  // hammasi osma bo'lsa javon yo'q, tortma oxirgi bo'limda
  const all = sectionPlan(2, 4, 5, 1);
  assert.equal(all.reduce((s, r) => s + r.shelves, 0), 0);
  assert.equal(all[1].drawers, 1);
  const ys = shelfYs(0, 1000, 4, 16);
  assert.equal(ys.length, 4);
  assert.ok(ys[0] > 0 && ys[3] < 1000);
});

test("shkaf 1800: javon soni faqat javonli bo'limlar uchun hisoblanadi", () => {
  const r = buildShkaf({ ...SHKAF_DEFAULT, width: 1800, shelves: 4, rods: 1 });
  const javon = r.parts.find((p) => p.name === "Javon")!;
  // 1800 mm, javonli: 2 ta bokovoy → 3 bo'lim; 1 ta osma, 2 ta javonli → 8 ta javon
  assert.equal(javon.qty, 8);
  assert.ok(r.notes.some((n) => n.includes("1 ta osma")));
  assert.equal(r.furniture.find((f) => f.name.startsWith("Shtanga ("))!.qty, 1);
});
