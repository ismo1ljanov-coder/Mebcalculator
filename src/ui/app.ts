import { calculate } from "../core/calculator.ts";
import type { FurnitureType } from "../core/templates.ts";
import {
  FIELDS,
  KITCHEN_FIELDS,
  MODULE_FIELDS,
  NEW_MODULE,
  TYPE_LABELS,
  buildFor,
  clamp,
  defaultState,
} from "./forms.ts";
import type { AppState, Field } from "./forms.ts";
import {
  adviceSection,
  cutSection,
  elevationSVG,
  esc,
  fmt,
  fmt1,
  furnitureSection,
  materialSection,
  partsTable,
  summaryCards,
  typeTitle,
} from "./render.ts";

const KEY = "mebcalc.v1";
const ICONS: Record<FurnitureType, string> = { shkaf: "🚪", kupe: "↔️", oshxona: "🍳", krovat: "🛏️", divan: "🛋️" };
const TABS = [
  ["chizma", "Chizma"],
  ["raskroy", "Raskroy"],
  ["material", "Material"],
  ["kesim", "Kesim"],
  ["furnitura", "Furnitura"],
  ["maslahat", "Maslahat"],
] as const;

let state: AppState = load();
let view: "input" | "result" = "input";
let tab = "chizma";

function load(): AppState {
  const d = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    // Eski/yaroqsiz saqlangan ma'lumotdan himoya: faqat tanish kalitlarni olamiz
    const merged: AppState = {
      type: s.type in TYPE_LABELS ? s.type : d.type,
      params: {
        shkaf: { ...d.params.shkaf, ...s.params?.shkaf },
        kupe: { ...d.params.kupe, ...s.params?.kupe },
        oshxona: {
          ...d.params.oshxona,
          ...s.params?.oshxona,
          modules: Array.isArray(s.params?.oshxona?.modules) ? s.params.oshxona.modules : d.params.oshxona.modules,
        },
        krovat: { ...d.params.krovat, ...s.params?.krovat },
        divan: { ...d.params.divan, ...s.params?.divan },
      },
      sheet: { ...d.sheet, ...s.sheet },
      prices: {
        ...d.prices,
        ...s.prices,
        sheetByThickness: { ...d.prices.sheetByThickness, ...s.prices?.sheetByThickness },
        labor: s.prices?.labor?.mode ? s.prices.labor : d.prices.labor,
      },
    };
    return merged;
  } catch {
    return d;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* xotira to'lgan yoki taqiqlangan — ilova baribir ishlaydi */
  }
}

const root = document.getElementById("app")!;

// ---------------------------------------------------------------- Kiritish

function numberInput(f: Field, value: number, attrs: string): string {
  return `<label class="fld"><span>${esc(f.label)} <em>(${esc(f.unit)})</em></span><input type="number" inputmode="numeric" min="${f.min}" max="${f.max}" value="${value}" ${attrs}></label>`;
}

function inputView(): string {
  const tiles = (Object.keys(TYPE_LABELS) as FurnitureType[])
    .map((t) => `<button class="tile ${t === state.type ? "on" : ""}" data-type="${t}"><span class="ico">${ICONS[t]}</span>${TYPE_LABELS[t]}</button>`)
    .join("");

  let form = "";
  if (state.type === "oshxona") {
    const k = state.params.oshxona as unknown as Record<string, number>;
    form += `<section class="card"><h2>Oshxona o'lchamlari</h2><div class="grid">${KITCHEN_FIELDS.map((f) => numberInput(f, k[f.key], `data-scope="params" data-key="${f.key}"`)).join("")}</div></section>`;
    form += `<section class="card"><h2>Modullar</h2>${state.params.oshxona.modules
      .map(
        (m, i) => `<div class="mod"><div class="modhead"><select data-scope="mod" data-i="${i}" data-key="kind"><option value="past" ${m.kind === "past" ? "selected" : ""}>Pastki tumba</option><option value="yuqori" ${m.kind === "yuqori" ? "selected" : ""}>Yuqori shkaf</option></select><button class="ghost" data-del="${i}" aria-label="O'chirish">✕</button></div><div class="grid4">${MODULE_FIELDS.map((f) => numberInput(f, (m as unknown as Record<string, number>)[f.key], `data-scope="mod" data-i="${i}" data-key="${f.key}"`)).join("")}</div></div>`,
      )
      .join("")}<button class="btn2" id="addmod">+ Modul qo'shish</button></section>`;
  } else {
    const p = state.params[state.type] as unknown as Record<string, number>;
    const fields = FIELDS[state.type];
    form += `<section class="card"><h2>${esc(typeTitle(state.type))} — o'lchamlar</h2><div class="grid">${fields.map((f) => numberInput(f, p[f.key], `data-scope="params" data-key="${f.key}"`)).join("")}</div></section>`;
  }

  const s = state.sheet;
  const pr = state.prices;
  const thicknesses = [16, 18];
  form += `<details class="card"><summary><h2>Material va narxlar</h2></summary>
<div class="grid">
${numberInput({ key: "length", label: "List uzunligi", unit: "mm", min: 1000, max: 4000 }, s.length, `data-scope="sheet" data-key="length"`)}
${numberInput({ key: "width", label: "List eni", unit: "mm", min: 800, max: 2500 }, s.width, `data-scope="sheet" data-key="width"`)}
${numberInput({ key: "kerf", label: "Arra qalinligi (kerf)", unit: "mm", min: 0, max: 10 }, s.kerf, `data-scope="sheet" data-key="kerf"`)}
${numberInput({ key: "trim", label: "List chetidan kesish", unit: "mm", min: 0, max: 30 }, s.trim, `data-scope="sheet" data-key="trim"`)}
${thicknesses.map((t) => numberInput({ key: String(t), label: `LDSP ${t} mm — 1 list narxi`, unit: "so'm", min: 0, max: 100000000 }, pr.sheetByThickness[t] ?? 0, `data-scope="priceT" data-key="${t}"`)).join("")}
${numberInput({ key: "edgePerMeter", label: "Kant — 1 metr narxi", unit: "so'm", min: 0, max: 1000000 }, pr.edgePerMeter, `data-scope="price" data-key="edgePerMeter"`)}
${numberInput({ key: "backPanelSheet", label: "DVP — 1 list narxi", unit: "so'm", min: 0, max: 100000000 }, pr.backPanelSheet, `data-scope="price" data-key="backPanelSheet"`)}
${numberInput({ key: "labor", label: "Usta ish haqi (materialdan)", unit: "%", min: 0, max: 300 }, pr.labor.value, `data-scope="labor"`)}
${numberInput({ key: "marginPercent", label: "Foyda", unit: "%", min: 0, max: 200 }, pr.marginPercent, `data-scope="price" data-key="marginPercent"`)}
</div>
<p class="muted">Narxlar telefoningizda saqlanadi. Standart bo'yicha 0 — bozor narxini o'zingiz kiriting.</p></details>`;

  return `<div class="tiles">${tiles}</div>${form}<button class="cta" id="calc">Hisoblash</button>`;
}

// ---------------------------------------------------------------- Natija

function resultView(): string {
  const build = buildFor(state);
  const sheet = state.sheet;
  const calc = calculate(build, sheet, state.prices);
  const dims = { length: sheet.length, width: sheet.width, trim: sheet.trim };

  const panes: Record<string, string> = {
    chizma: `<div class="drawwrap">${elevationSVG(state)}</div><p class="muted">Sxematik chizma. Aniq detallar "Kesim" va "Raskroy" bo'limlarida.</p>`,
    raskroy: cutSection(calc, dims, build.parts),
    material: materialSection(calc, sheet, state),
    kesim: partsTable(build.parts),
    furnitura: furnitureSection(build),
    maslahat: adviceSection(calc, build),
  };

  const dimText = describe();
  const tabs = TABS.map(([id, label]) => `<button class="tab ${id === tab ? "on" : ""}" data-tab="${id}">${label}</button>`).join("");
  const panesHtml = TABS.map(([id, label]) => `<section class="pane ${id === tab ? "on" : ""}" data-pane="${id}"><h2 class="printonly">${label}</h2>${panes[id]}</section>`).join("");

  return `<div class="top"><button class="ghost" id="back">← Orqaga</button><div><h1>${esc(typeTitle(state.type))}</h1><div class="muted mono">${esc(dimText)}</div></div></div>
<div class="actions"><button class="btn2" id="share">Ulashish</button><button class="btn2" id="print">PDF / Chop etish</button></div>
<div class="stats">${summaryCards(calc, sheet.length * sheet.width)}</div>
${calc.cost.total > 0 ? `<div class="card total"><span>Taxminiy narx</span><b>${fmt(calc.cost.total)} so'm</b></div>` : ""}
<nav class="tabs">${tabs}</nav>${panesHtml}`;
}

function describe(): string {
  if (state.type === "oshxona") {
    const m = state.params.oshxona.modules;
    const len = m.filter((x) => x.kind === "past").reduce((s, x) => s + x.width, 0);
    return `${m.length} modul · pastki qator ${len} mm`;
  }
  const p = state.params[state.type] as unknown as Record<string, number>;
  if (state.type === "krovat") return `matras ${p.mattressWidth} × ${p.mattressLength} mm`;
  if (state.type === "divan") return `${p.length} × ${p.depth} × ${p.backHeight} mm`;
  return `${p.width} × ${p.height} × ${p.depth} mm`;
}

function shareText(): string {
  const build = buildFor(state);
  const calc = calculate(build, state.sheet, state.prices);
  const lines = [`${typeTitle(state.type)} — ${describe()}`];
  for (const g of calc.groups) lines.push(`LDSP ${g.thickness} mm: ${g.pack.sheets.length} ta list (qoldiq ${fmt1(g.pack.waste)}%)`);
  lines.push(`Kant: ${Math.ceil(calc.edge.withWaste)} m`);
  if (calc.backPanel.sheets) lines.push(`DVP: ${calc.backPanel.sheets} ta list`);
  if (calc.cost.total > 0) lines.push(`Taxminiy narx: ${fmt(calc.cost.total)} so'm`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- Hodisalar

function render() {
  root.innerHTML = view === "input" ? inputView() : resultView();
  window.scrollTo(0, 0);
}

function readNumber(el: HTMLInputElement, f: Pick<Field, "min" | "max">): number {
  return clamp(Number(el.value), f);
}

root.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!t) return;
  if (t.dataset.type) {
    state.type = t.dataset.type as FurnitureType;
    save();
    render();
  } else if (t.id === "calc") {
    view = "result";
    tab = "chizma";
    render();
  } else if (t.id === "back") {
    view = "input";
    render();
  } else if (t.dataset.tab) {
    tab = t.dataset.tab;
    root.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    root.querySelectorAll<HTMLElement>(".pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === tab));
  } else if (t.id === "addmod") {
    state.params.oshxona.modules.push({ ...NEW_MODULE });
    save();
    render();
  } else if (t.dataset.del !== undefined) {
    state.params.oshxona.modules.splice(Number(t.dataset.del), 1);
    save();
    render();
  } else if (t.id === "print") {
    window.print();
  } else if (t.id === "share") {
    const text = shareText();
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => (t.textContent = "Nusxalandi ✓")).catch(() => {});
  }
});

root.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const scope = el.dataset.scope;
  if (!scope) return;
  const key = el.dataset.key ?? "";

  if (scope === "mod") {
    const m = state.params.oshxona.modules[Number(el.dataset.i)] as unknown as Record<string, unknown>;
    if (!m) return;
    if (key === "kind") m[key] = el.value === "yuqori" ? "yuqori" : "past";
    else {
      const f = MODULE_FIELDS.find((x) => x.key === key);
      if (f) {
        m[key] = readNumber(el as HTMLInputElement, f);
        (el as HTMLInputElement).value = String(m[key]);
      }
    }
  } else if (scope === "params") {
    const fields = state.type === "oshxona" ? KITCHEN_FIELDS : FIELDS[state.type];
    const f = fields.find((x) => x.key === key);
    if (!f) return;
    const v = readNumber(el as HTMLInputElement, f);
    (state.params[state.type] as unknown as Record<string, number>)[key] = v;
    (el as HTMLInputElement).value = String(v);
  } else if (scope === "sheet") {
    const lim: Record<string, Pick<Field, "min" | "max">> = {
      length: { min: 1000, max: 4000 },
      width: { min: 800, max: 2500 },
      kerf: { min: 0, max: 10 },
      trim: { min: 0, max: 30 },
    };
    if (!lim[key]) return;
    const v = readNumber(el as HTMLInputElement, lim[key]);
    (state.sheet as Record<string, number>)[key] = v;
    (el as HTMLInputElement).value = String(v);
  } else if (scope === "priceT") {
    const v = readNumber(el as HTMLInputElement, { min: 0, max: 1e8 });
    state.prices.sheetByThickness[Number(key)] = v;
  } else if (scope === "price") {
    const v = readNumber(el as HTMLInputElement, { min: 0, max: 1e8 });
    (state.prices as unknown as Record<string, number>)[key] = v;
  } else if (scope === "labor") {
    state.prices.labor = { mode: "percent", value: readNumber(el as HTMLInputElement, { min: 0, max: 300 }) };
  }
  save();
});

render();
