// Brauzersiz tekshiruv: soxta DOM bilan ilovaning asosiy oqimlarini ishga tushiradi.
import { test } from "node:test";
import assert from "node:assert/strict";

const els: Record<string, any> = {};
const handlers: Record<string, ((e: any) => void)[]> = {};
const store: Record<string, string> = {};
const mkEl = (id: string) => ({
  id,
  innerHTML: "",
  value: "",
  dataset: {} as Record<string, string>,
  classList: { toggle() {} },
  scrollIntoView() {},
  showModal() { this.open = true; },
  close() { this.open = false; },
  open: false,
});
(globalThis as any).document = {
  getElementById: (id: string) => (els[id] ??= mkEl(id)),
  addEventListener: (t: string, f: any) => (handlers[t] ??= []).push(f),
  querySelectorAll: () => [],
};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) };
(globalThis as any).requestAnimationFrame = (f: () => void) => f();
(globalThis as any).window = { print() {}, scrollTo() {} };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
(globalThis as any).location = { protocol: "file:" };

const click = (dataset: Record<string, string>, extra: Record<string, unknown> = {}) => {
  const btn = { dataset, id: (extra.id as string) ?? "", parentElement: extra.parentElement, textContent: "x" };
  for (const h of handlers.click) h({ target: { closest: () => btn } });
};
const typeInto = (key: string, value: string, scope = "params", min = 300, max = 4000, commit = false) => {
  const inp = { value, min: String(min), max: String(max), dataset: { scope, key }, matches: () => true };
  for (const h of handlers[commit ? "change" : "input"]) h({ target: inp });
  return inp;
};
const saved = () => JSON.parse(store["mebcalc.v2"]);

await import("./app.ts");

test("ishga tushganda barcha bo'limlar to'ldiriladi", () => {
  assert.ok(els.types.innerHTML.includes("Shkaf") && els.types.innerHTML.includes("Oshxona"));
  assert.ok(els.inputs.innerHTML.includes("lchamlar"));
  assert.ok(els.inputs.innerHTML.includes("Tsokol") && els.inputs.innerHTML.includes("Nikel oyoq"));
  assert.ok(els.draw.innerHTML.startsWith("<svg"));
  assert.ok(els.stats.innerHTML.includes("LDSP list"));
  assert.ok(els.panes.innerHTML.includes("Raskroy") && els.panes.innerHTML.includes("<svg"));
  assert.ok(els.bar.innerHTML.includes("qoldiq"));
  for (const k of ["types", "inputs", "draw", "stats", "panes", "bar", "tabs", "stagehead", "price", "printhead"]) {
    assert.ok(!els[k].innerHTML.includes("NaN") && !els[k].innerHTML.includes("undefined"), k);
  }
});

test("har bir mebel turiga o'tish xatosiz ishlaydi", () => {
  for (const t of ["kupe", "oshxona", "krovat", "divan", "shkaf"]) {
    click({ type: t });
    assert.equal(saved().type, t);
    assert.ok(els.draw.innerHTML.startsWith("<svg"), t);
    assert.ok(els.inputs.innerHTML.includes("LDSP qalinligi"), t);
    assert.ok(els.panes.innerHTML.includes("pane"), t);
  }
});

test("oyoq turi: nikelga o'tganda balandlik maydoni va nikel oyoq chizmada paydo bo'ladi", () => {
  click({ type: "shkaf" });
  click({ leg: "yoq" });
  assert.ok(!els.inputs.innerHTML.includes('data-key="plinth"'));
  click({ leg: "nikel" });
  assert.ok(els.inputs.innerHTML.includes('data-key="plinth"'));
  assert.equal(saved().params.shkaf.legType, "nikel");
  assert.equal(saved().params.shkaf.plinth, 150);
  assert.ok(els.draw.innerHTML.includes("legn"));
  assert.ok(els.panes.innerHTML.includes("Nikel (xrom) oyoq"));
  click({ leg: "tsokol" });
  assert.equal(saved().params.shkaf.plinth, 100); // 150 tavsiya qiymati edi, shuning uchun almashtirildi
  typeInto("plinth", "120", "params", 30, 250, true);
  click({ leg: "nikel" });
  assert.equal(saved().params.shkaf.plinth, 120); // ustaning o'z qiymati saqlanadi
  click({ leg: "tsokol" });
  typeInto("plinth", "100", "params", 30, 250, true);
  assert.ok(els.panes.innerHTML.includes("Tsokol planka"));
});

test("yozish davomida oraliq qiymat e'tiborga olinmaydi, to'liq qiymat qabul qilinadi", () => {
  typeInto("width", "1");
  assert.equal(saved().params.shkaf.width, 1200);
  typeInto("width", "1500");
  assert.equal(saved().params.shkaf.width, 1500);
  const inp = typeInto("width", "99999", "params", 300, 4000, true);
  assert.equal(saved().params.shkaf.width, 4000);
  assert.equal(inp.value, "4000");
  typeInto("width", "1200", "params", 300, 4000, true);
});

test("+/- tugmasi sonni o'zgartiradi va chegarada to'xtaydi", () => {
  const input = { value: "2", min: "0", max: "6", dataset: { scope: "params", key: "doors" } };
  const parentElement = { querySelector: () => input };
  click({ step: "1" }, { parentElement });
  assert.equal(saved().params.shkaf.doors, 3);
  input.value = "6";
  click({ step: "1" }, { parentElement });
  assert.equal(saved().params.shkaf.doors, 6);
  input.value = "0";
  click({ step: "-1" }, { parentElement });
  assert.equal(saved().params.shkaf.doors, 0);
});

test("oshxona: modul qo'shish va o'chirish", () => {
  click({ type: "oshxona" });
  const n = saved().params.oshxona.modules.length;
  click({}, { id: "addmod" });
  assert.equal(saved().params.oshxona.modules.length, n + 1);
  click({ del: "0" });
  assert.equal(saved().params.oshxona.modules.length, n);
  click({ type: "shkaf" });
});

test("qalinlik va tez o'lchamlar", () => {
  click({ th: "18" });
  assert.equal(saved().params.shkaf.thickness, 18);
  click({ pw: "1500" });
  assert.equal(saved().params.shkaf.width, 1500);
  click({ th: "16" });
});

test("narx kiritilganda narx paneli ko'rinadi", () => {
  assert.ok(els.price.innerHTML.includes("Narxni ko'rish"));
  typeInto("16", "300000", "priceT", 0, 100000000);
  typeInto("edgePerMeter", "2000", "price", 0, 1000000);
  assert.ok(els.price.innerHTML.includes("Taxminiy narx"), els.price.innerHTML);
});

test("loyihani saqlash, ochish va o'chirish", () => {
  click({}, { id: "openproj" });
  assert.ok(els.dlg.open && els.dlg.innerHTML.includes("Hali loyiha saqlanmagan"));
  els.pname = { value: "Aziz aka shkafi" };
  click({ saveproj: "" });
  assert.ok(els.dlg.innerHTML.includes("Aziz aka shkafi"));
  const id = JSON.parse(store["mebcalc.projects.v2"])[0].id;
  typeInto("width", "2000", "params", 300, 4000, true);
  assert.equal(saved().params.shkaf.width, 2000);
  click({ openp: id });
  assert.equal(saved().params.shkaf.width, 1500); // saqlangan paytdagi qiymat qaytdi
  click({ delp: id });
  assert.ok(els.dlg.innerHTML.includes("Hali loyiha saqlanmagan"));
});

test("sarlavha HTMLga xavfsiz chiqariladi", () => {
  typeInto("", '<img src=x onerror=alert(1)>', "title");
  assert.ok(!els.printhead.innerHTML.includes("<img"));
  assert.ok(els.printhead.innerHTML.includes("&lt;img"));
});
