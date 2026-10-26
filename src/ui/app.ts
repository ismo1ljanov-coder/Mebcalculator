import { calculate } from "../core/calculator.ts";
import type { CalcResult } from "../core/calculator.ts";
import type { BuildResult, FurnitureType } from "../core/templates.ts";
import {
  BED_LEGS,
  FRAME_LEGS,
  GROUPS,
  KITCHEN_GROUPS,
  MATTRESS_PRESETS,
  MODULE_FIELDS,
  NEW_MODULE,
  SUGGESTED_LEG_HEIGHT,
  THICKNESSES,
  TYPE_LABELS,
  WIDTH_PRESETS,
  buildFor,
  clamp,
  defaultState,
} from "./forms.ts";
import type { AppState, Field, Group } from "./forms.ts";
import { defaultView, render3D } from "./view3d.ts";
import type { View } from "./view3d.ts";
import {
  adviceSection,
  barSummary,
  cutListText,
  cutSection,
  describeState,
  drawingSVG,
  esc,
  fmt,
  fmt1,
  furnitureSection,
  materialSection,
  partsTable,
  partsCheck,
  statsStrip,
  typeTitle,
} from "./render.ts";

const KEY = "mebcalc.v2";
const PKEY = "mebcalc.projects.v2";
const TABS = [
  ["raskroy", "Raskroy"],
  ["kesim", "Kesim ro'yxati"],
  ["material", "Material va narx"],
  ["furnitura", "Furnitura"],
  ["maslahat", "Maslahat"],
] as const;
const TYPES = Object.keys(TYPE_LABELS) as FurnitureType[];

// ---------------------------------------------------------------- Saqlash

type Project = { id: string; name: string; savedAt: string; snapshot: AppState };

/** Saqlangan yoki eski ma'lumotni xavfsiz holatga keltiradi: noma'lum kalitlar tashlanadi, sonlar chegaralanadi */
export function normalizeState(raw: unknown): AppState {
  const d = defaultState();
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const out: AppState = {
    type: TYPES.includes(s.type) ? s.type : d.type,
    title: typeof s.title === "string" ? s.title.slice(0, 60) : "",
    params: {
      shkaf: { ...d.params.shkaf, ...pick(s.params?.shkaf, d.params.shkaf) },
      kupe: { ...d.params.kupe, ...pick(s.params?.kupe, d.params.kupe) },
      oshxona: {
        ...d.params.oshxona,
        ...pick(s.params?.oshxona, d.params.oshxona),
        modules: Array.isArray(s.params?.oshxona?.modules)
          ? s.params.oshxona.modules.slice(0, 30).map((m: any) => ({ ...NEW_MODULE, ...pick(m, NEW_MODULE) }))
          : d.params.oshxona.modules,
      },
      krovat: { ...d.params.krovat, ...pick(s.params?.krovat, d.params.krovat) },
      divan: { ...d.params.divan, ...pick(s.params?.divan, d.params.divan) },
    },
    sheet: { ...d.sheet, ...pick(s.sheet, d.sheet) },
    prices: {
      ...d.prices,
      ...pick(s.prices, d.prices),
      sheetByThickness: { ...d.prices.sheetByThickness, ...(typeof s.prices?.sheetByThickness === "object" ? s.prices.sheetByThickness : {}) },
      labor: s.prices?.labor?.mode === "percent" || s.prices?.labor?.mode === "fixed" ? s.prices.labor : d.prices.labor,
    },
  };
  sanitize(out);
  return out;
}

/** Faqat standart obyektda bor kalitlarni va bir xil tipdagilarni oladi */
function pick(src: any, tpl: Record<string, any>): Record<string, any> {
  const o: Record<string, any> = {};
  if (!src || typeof src !== "object") return o;
  for (const k of Object.keys(tpl)) {
    if (k === "modules") continue;
    if (typeof src[k] === typeof tpl[k] && (typeof tpl[k] !== "number" || Number.isFinite(src[k]))) o[k] = src[k];
  }
  return o;
}

function sanitize(st: AppState) {
  const lim = (v: number, min: number, max: number) => clamp(v, { min, max });
  for (const t of ["shkaf", "kupe", "krovat", "divan"] as const) {
    const p = st.params[t] as unknown as Record<string, number>;
    const groups: Group[] = GROUPS[t];
    for (const g of groups) for (const f of g.fields) p[f.key] = lim(p[f.key], f.min, f.max);
  }
  for (const g of KITCHEN_GROUPS) for (const f of g.fields) (st.params.oshxona as any)[f.key] = lim((st.params.oshxona as any)[f.key], f.min, f.max);
  for (const m of st.params.oshxona.modules as any[]) {
    m.kind = m.kind === "yuqori" ? "yuqori" : "past";
    for (const f of MODULE_FIELDS) m[f.key] = lim(m[f.key], f.min, f.max);
  }
  const th = (v: number) => ((THICKNESSES as readonly number[]).includes(v) ? v : 16);
  for (const t of TYPES) (st.params[t] as any).thickness = th((st.params[t] as any).thickness);
  for (const t of ["shkaf", "kupe", "oshxona"] as const) {
    const p = st.params[t] as any;
    p.legType = ["yoq", "tsokol", "nikel"].includes(p.legType) ? p.legType : "yoq";
    p.plinth = lim(p.plinth, 0, 250);
  }
  for (const t of ["krovat", "divan"] as const) {
    const p = st.params[t] as any;
    p.legType = ["yogoch", "nikel", "plastik"].includes(p.legType) ? p.legType : "yogoch";
    p.legHeight = lim(p.legHeight, 50, 400);
  }
  st.sheet.length = lim(st.sheet.length, 1000, 4000);
  st.sheet.width = lim(st.sheet.width, 800, 2500);
  st.sheet.kerf = lim(st.sheet.kerf, 0, 10);
  st.sheet.trim = lim(st.sheet.trim, 0, 30);
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}
function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* xotira to'lgan yoki taqiqlangan: ilova baribir ishlaydi */
  }
}
function loadProjects(): Project[] {
  try {
    const a = JSON.parse(localStorage.getItem(PKEY) ?? "[]");
    return Array.isArray(a) ? a.filter((p) => p && typeof p.id === "string" && typeof p.name === "string") : [];
  } catch {
    return [];
  }
}
function saveProjects(list: Project[]) {
  try {
    localStorage.setItem(PKEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ruxsat yo'q */
  }
}

// ---------------------------------------------------------------- Holat

let state: AppState = typeof document !== "undefined" ? loadState() : defaultState();
let tab = "raskroy";
let last: { build: BuildResult; calc: CalcResult } | null = null;

const $ = (id: string) => document.getElementById(id)!;

// ---------------------------------------------------------------- Kiritish formasi

function fieldHTML(f: Field, value: number, attrs: string): string {
  const input = `<input type="number" inputmode="numeric" min="${f.min}" max="${f.max}" value="${value}" ${attrs} aria-label="${esc(f.label)}">`;
  if (f.stepper) {
    return `<label class="fld"><span>${esc(f.label)}</span><div class="step"><button type="button" data-step="-1" aria-label="Kamaytirish">−</button>${input}<button type="button" data-step="1" aria-label="Ko'paytirish">+</button></div></label>`;
  }
  return `<label class="fld"><span>${esc(f.label)} <i>${esc(f.unit)}</i></span>${input}</label>`;
}

function groupHTML(g: Group, values: Record<string, number>, scope = "params"): string {
  return `<section class="sec"><h2>${esc(g.title)}</h2><div class="row c${g.cols}">${g.fields
    .map((f) => fieldHTML(f, values[f.key], `data-scope="${scope}" data-key="${f.key}"`))
    .join("")}</div>`;
}

function legsHTML(): string {
  const t = state.type;
  if (t === "krovat" || t === "divan") {
    const p = state.params[t];
    return `<section class="sec"><h2>Oyoq</h2><div class="seg">${BED_LEGS.map(
      (l) => `<button type="button" data-bleg="${l.id}" class="${p.legType === l.id ? "on" : ""}">${l.label}</button>`,
    ).join("")}</div><div class="row" style="margin-top:10px">${fieldHTML(
      { key: "legHeight", label: "Oyoq balandligi", unit: "mm", min: 50, max: 400 },
      p.legHeight,
      `data-scope="params" data-key="legHeight"`,
    )}</div></section>`;
  }
  const p = state.params[t] as { legType: "yoq" | "tsokol" | "nikel"; plinth: number };
  const cur = FRAME_LEGS.find((l) => l.id === p.legType)!;
  return `<section class="sec"><h2>Oyoq</h2><div class="seg">${FRAME_LEGS.map(
    (l) => `<button type="button" data-leg="${l.id}" class="${p.legType === l.id ? "on" : ""}">${l.label}</button>`,
  ).join("")}</div><p class="hint">${esc(cur.hint)}${p.legType === "yoq" ? "" : ". Oyoq balandligi umumiy balandlikka kiradi."}</p>${
    p.legType === "yoq"
      ? ""
      : `<div class="row" style="margin-top:10px">${fieldHTML({ key: "plinth", label: p.legType === "tsokol" ? "Tsokol balandligi" : "Oyoq balandligi", unit: "mm", min: 30, max: 250 }, p.plinth, `data-scope="params" data-key="plinth"`)}</div>`
  }</section>`;
}

function inputsHTML(): string {
  const t = state.type;
  const h: string[] = [];
  h.push(
    `<section class="sec"><label class="fld"><span>Loyiha yoki mijoz nomi</span><input type="text" data-scope="title" value="${esc(state.title)}" placeholder="Masalan: Aziz aka, yotoqxona shkafi" maxlength="60"></label></section>`,
  );

  if (t === "oshxona") {
    const k = state.params.oshxona as unknown as Record<string, number>;
    for (const g of KITCHEN_GROUPS) h.push(groupHTML(g, k) + "</section>");
    h.push(
      `<section class="sec"><h2>Modullar</h2>${state.params.oshxona.modules
        .map(
          (m, i) => `<div class="mod"><div class="modhead"><select data-scope="mod" data-i="${i}" data-key="kind" aria-label="Modul turi"><option value="past" ${m.kind === "past" ? "selected" : ""}>Pastki tumba</option><option value="yuqori" ${m.kind === "yuqori" ? "selected" : ""}>Yuqori shkaf</option></select><button type="button" class="iconbtn" data-del="${i}" aria-label="Modulni o'chirish">✕</button></div><div class="row c4">${MODULE_FIELDS.map((f) =>
            fieldHTML(f, (m as unknown as Record<string, number>)[f.key], `data-scope="mod" data-i="${i}" data-key="${f.key}"`),
          ).join("")}</div></div>`,
        )
        .join("")}<button type="button" class="btn2" id="addmod">+ Modul qo'shish</button></section>`,
    );
  } else {
    const p = state.params[t] as unknown as Record<string, number>;
    GROUPS[t].forEach((g, i) => {
      let html = groupHTML(g, p);
      if (i === 0 && (t === "shkaf" || t === "kupe")) {
        html += `<div class="chips">${WIDTH_PRESETS[t]
          .map((w) => `<button type="button" class="chip ${p.width === w ? "on" : ""}" data-pw="${w}">${w}</button>`)
          .join("")}</div>`;
      }
      if (i === 0 && t === "krovat") {
        html += `<div class="chips">${MATTRESS_PRESETS.map(
          ([w, l]) => `<button type="button" class="chip ${p.mattressWidth === w && p.mattressLength === l ? "on" : ""}" data-pm="${w}x${l}">${w}×${l}</button>`,
        ).join("")}</div>`;
      }
      h.push(html + "</section>");
    });
  }

  h.push(legsHTML());

  const th = (state.params[t] as unknown as { thickness: number }).thickness;
  h.push(
    `<section class="sec"><h2>LDSP qalinligi</h2><div class="seg">${THICKNESSES.map((v) => `<button type="button" data-th="${v}" class="${th === v ? "on" : ""}">${v} mm</button>`).join("")}</div></section>`,
  );

  const s = state.sheet;
  const pr = state.prices;
  const num = (key: string, label: string, unit: string, min: number, max: number, v: number, attrs: string) =>
    fieldHTML({ key, label, unit, min, max }, v, attrs);
  h.push(`<details class="sec"><summary>Material va narxlar</summary>
<div class="row c2">
${num("length", "List uzunligi", "mm", 1000, 4000, s.length, `data-scope="sheet" data-key="length"`)}
${num("width", "List eni", "mm", 800, 2500, s.width, `data-scope="sheet" data-key="width"`)}
${num("kerf", "Arra qalinligi", "mm", 0, 10, s.kerf, `data-scope="sheet" data-key="kerf"`)}
${num("trim", "List chetidan kesish", "mm", 0, 30, s.trim, `data-scope="sheet" data-key="trim"`)}
${THICKNESSES.map((v) => num(String(v), `LDSP ${v} mm, 1 list`, "so'm", 0, 100000000, pr.sheetByThickness[v] ?? 0, `data-scope="priceT" data-key="${v}"`)).join("")}
${num("edgePerMeter", "Kant, 1 metr", "so'm", 0, 1000000, pr.edgePerMeter, `data-scope="price" data-key="edgePerMeter"`)}
${num("backPanelSheet", "DVP, 1 list", "so'm", 0, 100000000, pr.backPanelSheet, `data-scope="price" data-key="backPanelSheet"`)}
${num("labor", "Usta ish haqi (materialdan)", "%", 0, 300, pr.labor.mode === "percent" ? pr.labor.value : 0, `data-scope="labor"`)}
${num("marginPercent", "Foyda", "%", 0, 200, pr.marginPercent, `data-scope="price" data-key="marginPercent"`)}
</div>
<p class="hint">Narxlar telefoningizda saqlanadi. Boshlang'ich qiymat 0: bozor narxini o'zingiz kiriting.</p></details>`);
  return h.join("");
}

// ---------------------------------------------------------------- Yangilash

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

let mode: "2d" | "3d" = "2d";
let view: View = defaultView();
let inside = false;

function drawHTML(): string {
  const tabs = `<div class="vtabs"><button type="button" data-vmode="2d" class="${mode === "2d" ? "on" : ""}">2D chizma</button><button type="button" data-vmode="3d" class="${mode === "3d" ? "on" : ""}">3D ko'rinish</button></div>`;
  if (mode === "2d") return tabs + drawingSVG(state);
  const canOpen = state.type === "shkaf" || state.type === "kupe";
  const tools = `<div class="v3tools"><span>Barmoq bilan suring: aylantirish</span>${canOpen ? `<button type="button" data-vinside="1" class="${inside ? "on" : ""}">${inside ? "Eshikni yop" : "Ichini ko'rsat"}</button>` : ""}<button type="button" data-vreset="1">Qayta</button></div>`;
  return tabs + `<div class="v3" id="v3">${render3D(state, view, { inside: inside && canOpen })}</div>` + tools;
}

function redraw3D() {
  const el = document.getElementById("v3");
  if (el) el.innerHTML = render3D(state, view, { inside: inside && (state.type === "shkaf" || state.type === "kupe") });
}

function update() {
  const build = buildFor(state);
  const calc = calculate(build, state.sheet, state.prices);
  last = { build, calc };
  const dims = { length: state.sheet.length, width: state.sheet.width, trim: state.sheet.trim };

  $("stagehead").innerHTML = `<h1>${esc(typeTitle(state.type))}</h1><span>${esc(describeState(state))}</span>`;
  $("draw").innerHTML = drawHTML();
  $("stats").innerHTML = statsStrip(calc);
  $("price").innerHTML =
    calc.cost.total > 0
      ? `<div class="pricebar"><span>Taxminiy narx</span><b>${fmt(calc.cost.total)} so'm</b></div>`
      : `<div class="pricehint">Narxni ko'rish uchun "Material va narxlar" bo'limiga list va kant narxini kiriting.</div>`;

  const panes: Record<string, string> = {
    raskroy: cutSection(calc, dims, build.parts),
    kesim: `<button type="button" class="hbtn" id="copycut" style="margin-bottom:10px">Ro'yxatni nusxalash</button>${partsCheck(build.parts, calc)}${partsTable(build.parts)}`,
    material: materialSection(calc, state.sheet, state),
    furnitura: furnitureSection(build),
    maslahat: adviceSection(calc, build),
  };
  $("panes").innerHTML = TABS.map(
    ([id, label]) => `<section class="pane ${id === tab ? "on" : ""}" data-pane="${id}"><h2 class="printonly">${label}</h2>${panes[id]}</section>`,
  ).join("");

  const b = barSummary(calc);
  $("bar").innerHTML = `<div class="bi"><b>${b.sheets}</b><small>list</small></div><div class="bi"><b>${fmt1(b.waste)}%</b><small>qoldiq</small></div>${
    b.cost > 0 ? `<div class="bi cost"><b>${fmt(b.cost)}</b><small>so'm</small></div>` : ""
  }<button type="button" id="gores">Natija</button>`;

  $("printhead").innerHTML = `<h1>${esc(state.title || typeTitle(state.type))}</h1><div>${esc(typeTitle(state.type))}, ${esc(describeState(state))}. Sana: ${today()}</div>`;
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    update();
  });
}

function renderTypes() {
  $("types").innerHTML = TYPES.map((t) => `<button type="button" class="type ${t === state.type ? "on" : ""}" data-type="${t}">${TYPE_LABELS[t]}</button>`).join("");
}
function renderInputs() {
  $("inputs").innerHTML = inputsHTML();
}
function renderTabs() {
  $("tabs").innerHTML = TABS.map(([id, label]) => `<button type="button" class="tab ${id === tab ? "on" : ""}" data-tab="${id}">${label}</button>`).join("");
}
function rerenderAll() {
  renderTypes();
  renderInputs();
  update();
}

// ---------------------------------------------------------------- Kiritishni qayta ishlash

function applyInput(el: HTMLInputElement | HTMLSelectElement, commit: boolean) {
  const scope = el.dataset.scope;
  if (!scope) return;
  const key = el.dataset.key ?? "";

  if (scope === "title") {
    state.title = el.value.slice(0, 60);
    saveState();
    schedule();
    return;
  }
  if (scope === "mod" && key === "kind") {
    const m = state.params.oshxona.modules[Number(el.dataset.i)];
    if (m) m.kind = el.value === "yuqori" ? "yuqori" : "past";
    saveState();
    schedule();
    return;
  }

  // Raqamli maydon
  const inp = el as HTMLInputElement;
  const raw = Number(inp.value);
  const min = Number(inp.min);
  const max = Number(inp.max);
  if (inp.value === "" || !Number.isFinite(raw)) {
    if (commit) inp.value = String(clamp(raw, { min, max }));
    else return;
  }
  // Yozish davomida (masalan "1" -> "12" -> "1200") minimumdan kichik oraliq qiymatlar e'tiborga olinmaydi
  if (!commit && raw < min) return;
  const v = clamp(raw, { min, max });
  if (commit) inp.value = String(v);

  if (scope === "params") (state.params[state.type] as unknown as Record<string, number>)[key] = v;
  else if (scope === "mod") {
    const m = state.params.oshxona.modules[Number(el.dataset.i)] as unknown as Record<string, number> | undefined;
    if (m) m[key] = v;
  } else if (scope === "sheet") (state.sheet as Record<string, number>)[key] = v;
  else if (scope === "priceT") state.prices.sheetByThickness[Number(key)] = v;
  else if (scope === "price") (state.prices as unknown as Record<string, number>)[key] = v;
  else if (scope === "labor") state.prices.labor = { mode: "percent", value: v };

  saveState();
  schedule();
}

function toast(btn: HTMLElement, text: string) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1600);
}

function shareText(): string {
  if (!last) return "";
  const { calc } = last;
  const lines = [state.title || typeTitle(state.type), `${typeTitle(state.type)}, ${describeState(state)}`];
  for (const g of calc.groups) lines.push(`LDSP ${g.thickness} mm: ${g.pack.sheets.length} ta list (qoldiq ${fmt1(g.pack.waste)}%)`);
  lines.push(`Kant: ${Math.ceil(calc.edge.withWaste)} m`);
  if (calc.backPanel.sheets) lines.push(`DVP: ${calc.backPanel.sheets} ta list`);
  if (calc.cost.total > 0) lines.push(`Taxminiy narx: ${fmt(calc.cost.total)} so'm`);
  return lines.join("\n");
}

function onClick(e: Event) {
  const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!t) return;
  const d = t.dataset;

  if (d.vmode) {
    mode = d.vmode as "2d" | "3d";
    update();
  } else if (d.vinside) {
    inside = !inside;
    update();
  } else if (d.vreset) {
    view = defaultView();
    update();
  } else if (d.type) {
    state.type = d.type as FurnitureType;
    saveState();
    rerenderAll();
  } else if (d.step) {
    const inp = t.parentElement!.querySelector("input")!;
    const cur = Number(inp.value) || 0;
    inp.value = String(clamp(cur + Number(d.step), { min: Number(inp.min), max: Number(inp.max) }));
    applyInput(inp, true);
  } else if (d.leg) {
    const p = state.params[state.type as "shkaf" | "kupe" | "oshxona"];
    p.legType = d.leg as typeof p.legType;
    // Oyoqsiz tanlansa balandlik saqlanib qoladi (hisobga olinmaydi). Boshqa turga o'tganda, agar
    // balandlik tavsiya qilingan qiymatlardan biri bo'lsa (0, 100, 150), yangi turning tavsiyasiga almashtiriladi;
    // ustaning o'z qiymati (masalan 120) o'zgarmaydi.
    if (p.legType !== "yoq" && Object.values(SUGGESTED_LEG_HEIGHT).includes(p.plinth)) p.plinth = SUGGESTED_LEG_HEIGHT[p.legType];
    saveState();
    renderInputs();
    schedule();
  } else if (d.bleg) {
    const p = state.params[state.type as "krovat" | "divan"];
    p.legType = d.bleg as typeof p.legType;
    saveState();
    renderInputs();
    schedule();
  } else if (d.th) {
    (state.params[state.type] as unknown as { thickness: number }).thickness = Number(d.th);
    saveState();
    renderInputs();
    schedule();
  } else if (d.pw) {
    (state.params[state.type as "shkaf" | "kupe"] as { width: number }).width = Number(d.pw);
    saveState();
    renderInputs();
    schedule();
  } else if (d.pm) {
    const [w, l] = d.pm.split("x").map(Number);
    state.params.krovat.mattressWidth = w;
    state.params.krovat.mattressLength = l;
    saveState();
    renderInputs();
    schedule();
  } else if (d.tab) {
    tab = d.tab;
    document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    document.querySelectorAll<HTMLElement>(".pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === tab));
  } else if (t.id === "addmod") {
    state.params.oshxona.modules.push({ ...NEW_MODULE });
    saveState();
    renderInputs();
    schedule();
  } else if (d.del !== undefined) {
    state.params.oshxona.modules.splice(Number(d.del), 1);
    saveState();
    renderInputs();
    schedule();
  } else if (t.id === "gores") {
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (t.id === "print") {
    window.print();
  } else if (t.id === "share") {
    const text = shareText();
    if (navigator.share) navigator.share({ title: state.title || typeTitle(state.type), text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast(t, "Nusxalandi")).catch(() => {});
  } else if (t.id === "copycut" && last) {
    navigator.clipboard?.writeText(cutListText(last.build.parts, state.title)).then(() => toast(t, "Nusxalandi")).catch(() => toast(t, "Nusxalab bo'lmadi"));
  } else if (t.id === "openproj") {
    openProjects();
  } else if (d.saveproj !== undefined) {
    const input = document.getElementById("pname") as HTMLInputElement;
    const name = input.value.trim() || state.title || `${typeTitle(state.type)}, ${today()}`;
    const list = loadProjects();
    list.unshift({ id: Date.now().toString(36), name: name.slice(0, 60), savedAt: new Date().toISOString(), snapshot: JSON.parse(JSON.stringify(state)) });
    saveProjects(list);
    renderProjects();
  } else if (d.openp) {
    const p = loadProjects().find((x) => x.id === d.openp);
    if (p) {
      state = normalizeState(p.snapshot);
      saveState();
      rerenderAll();
      (document.getElementById("dlg") as HTMLDialogElement).close();
    }
  } else if (d.delp) {
    saveProjects(loadProjects().filter((x) => x.id !== d.delp));
    renderProjects();
  } else if (d.closedlg !== undefined) {
    (document.getElementById("dlg") as HTMLDialogElement).close();
  }
}

// ---------------------------------------------------------------- Loyihalar oynasi

function renderProjects() {
  const list = loadProjects();
  $("dlg").innerHTML = `<div class="dlg"><h2>Loyihalar</h2>
<div class="saverow"><input type="text" id="pname" placeholder="Nom (masalan: Aziz aka shkafi)" maxlength="60" value="${esc(state.title)}"><button type="button" class="pbtn" data-saveproj>Saqlash</button></div>
<div class="plist">${
    list.length
      ? list
          .map(
            (p) =>
              `<div class="pitem"><button type="button" class="open" data-openp="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(typeTitle(p.snapshot?.type ?? "shkaf"))}, ${esc(new Date(p.savedAt).toLocaleDateString("ru-RU"))}</small></button><button type="button" class="iconbtn" data-delp="${esc(p.id)}" aria-label="O'chirish">✕</button></div>`,
          )
          .join("")
      : `<div class="empty">Hali loyiha saqlanmagan. Joriy hisobni nom bilan saqlang, keyin shu yerdan qayta ochasiz.</div>`
  }</div><button type="button" class="hbtn" data-closedlg>Yopish</button></div>`;
}
function openProjects() {
  renderProjects();
  const dlg = document.getElementById("dlg") as HTMLDialogElement;
  if (typeof dlg.showModal === "function") dlg.showModal();
}

// ---------------------------------------------------------------- Ishga tushirish

function start() {
  document.addEventListener("click", onClick);
  document.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.matches?.('input[data-scope]')) applyInput(el, false);
  });
  document.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el.matches?.("input[data-scope], select[data-scope]")) applyInput(el, true);
  });
  let drag: { x: number; y: number } | null = null;
  document.addEventListener("pointerdown", (e) => {
    const pe = e as PointerEvent;
    if ((pe.target as HTMLElement)?.closest?.("#v3")) drag = { x: pe.clientX, y: pe.clientY };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const pe = e as PointerEvent;
    view = {
      yaw: view.yaw + (pe.clientX - drag.x) * 0.5,
      pitch: Math.max(-5, Math.min(70, view.pitch + (pe.clientY - drag.y) * 0.4)),
    };
    drag = { x: pe.clientX, y: pe.clientY };
    redraw3D();
  });
  const end = () => {
    drag = null;
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  renderTabs();
  rerenderAll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

if (typeof document !== "undefined") start();
