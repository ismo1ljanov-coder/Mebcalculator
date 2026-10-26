import type { CalcResult } from "../core/calculator.ts";
import { dividerCount, legCountFor, legHeightOf, sectionPlan, shelfYs } from "../core/templates.ts";
import type { BuildResult, FurnitureType, KitchenModule } from "../core/templates.ts";
import type { PackedSheet, Part } from "../core/types.ts";
import { finishHex } from "./forms.ts";
import type { AppState } from "./forms.ts";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const fmt = (n: number): string => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toString();
export const fmt2 = (n: number): string => (Math.round(n * 100) / 100).toString();

export function typeTitle(type: FurnitureType): string {
  return { shkaf: "Shkaf", kupe: "Kupe shkaf", oshxona: "Oshxona garnituri", krovat: "Krovat", divan: "Divan" }[type];
}

// ------------------------------------------------------------ Asosiy ko'rsatkichlar

export function statsStrip(calc: CalcResult): string {
  const sheets = calc.groups.reduce((s, g) => s + g.pack.sheets.length, 0);
  const used = calc.groups.reduce((s, g) => s + g.pack.totalUsedArea, 0);
  const total = calc.groups.reduce((s, g) => s + g.pack.totalSheetArea, 0);
  const waste = total > 0 ? 100 - (used / total) * 100 : 0;
  const items = [
    { v: String(sheets), u: "ta", l: "LDSP list" },
    { v: fmt1(waste), u: "%", l: "Qoldiq" },
    { v: fmt1(calc.edge.withWaste), u: "m", l: "Kant" },
    { v: calc.backPanel.sheets ? String(calc.backPanel.sheets) : "0", u: "ta", l: "DVP list" },
  ];
  return items
    .map((c) => `<div class="stat"><div class="stat-v">${esc(c.v)}<small>${esc(c.u)}</small></div><div class="stat-l">${esc(c.l)}</div></div>`)
    .join("");
}

export function barSummary(calc: CalcResult): { sheets: number; waste: number; cost: number } {
  const sheets = calc.groups.reduce((s, g) => s + g.pack.sheets.length, 0);
  const used = calc.groups.reduce((s, g) => s + g.pack.totalUsedArea, 0);
  const total = calc.groups.reduce((s, g) => s + g.pack.totalSheetArea, 0);
  return { sheets, waste: total > 0 ? 100 - (used / total) * 100 : 0, cost: calc.cost.total };
}

// ------------------------------------------------------------ Kesim jadvali

/** Tekshiruv: jami detal soni raskroyga joylashgan detal soniga tengmi */
export function partsCheck(parts: Part[], calc: CalcResult): string {
  const total = parts.reduce((x, p) => x + p.qty, 0);
  const placed = calc.groups.reduce((x, g) => x + g.pack.sheets.reduce((y, sh) => y + sh.placements.length, 0), 0);
  const ok = placed === total;
  return `<p class="check ${ok ? "ok" : "bad"}"><b>Jami: ${total} ta detal</b> (${parts.length} xil). Raskroyga joylashgan: ${placed} ta ${ok ? "✓ hech biri qolmadi" : "⚠ ba'zilari sig'madi, ogohlantirishlarga qarang"}.</p>`;
}

export function partsTable(parts: Part[]): string {
  const rows = parts
    .map((p) => {
      const e = [p.edge.L1 && "U1", p.edge.L2 && "U2", p.edge.W1 && "E1", p.edge.W2 && "E2"].filter(Boolean).join(" ");
      return `<tr><td>${esc(p.name)}</td><td class="n">${p.length}</td><td class="n">${p.width}</td><td class="n">${p.qty}</td><td class="n">${p.thickness}</td><td>${p.grain ? "tola bo'ylab" : ""}</td><td>${e || "yo'q"}</td></tr>`;
    })
    .join("");
  return `<div class="tablewrap"><table><thead><tr><th>Detal</th><th>Uzun</th><th>Eni</th><th>Soni</th><th>mm</th><th>Tekstura</th><th>Kant</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="muted">Kant: U = uzun tomon, E = qisqa tomon. "Tola bo'ylab" yozilgan detallarni aylantirib bo'lmaydi. O'lchamlar mm.</p>`;
}

/** Stanokchiga yoki Telegram orqali yuborish uchun oddiy matn */
export function cutListText(parts: Part[], title = ""): string {
  const lines: string[] = [];
  if (title) lines.push(title);
  for (const p of parts) {
    const e = [p.edge.L1 && "U1", p.edge.L2 && "U2", p.edge.W1 && "E1", p.edge.W2 && "E2"].filter(Boolean).join(" ");
    lines.push(`${p.length} x ${p.width} x ${p.qty} ta (${p.thickness} mm) ${p.name}${e ? ", kant: " + e : ""}${p.grain ? ", tola" : ""}`);
  }
  return lines.join("\n");
}

// ------------------------------------------------------------ Raskroy (kesim sxemasi)

function hue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  // Yog'och va neytral ranglar tomon: 20..60 va 160..210 oralig'i
  return (h % 2 === 0 ? 20 + (h % 40) : 165 + (h % 45));
}

let hatchId = 0;

export function cutSheetSVG(
  sheet: PackedSheet,
  dims: { length: number; width: number; trim: number },
  partsById: Map<string, Part>,
): string {
  const { length: L, width: W, trim } = dims;
  hatchId += 1;
  const hid = `hx${hatchId}`;
  const out: string[] = [];
  out.push(`<svg class="cut" viewBox="0 0 ${L} ${W}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  out.push(`<defs><pattern id="${hid}" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="46" class="hatch"/></pattern></defs>`);
  out.push(`<rect x="0" y="0" width="${L}" height="${W}" class="sheet"/>`);
  out.push(`<rect x="0" y="0" width="${L}" height="${W}" fill="url(#${hid})"/>`);
  if (trim > 0) out.push(`<rect x="${trim}" y="${trim}" width="${L - 2 * trim}" height="${W - 2 * trim}" class="trim"/>`);
  for (const p of sheet.placements) {
    const part = partsById.get(p.partId);
    out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" class="piece" style="--h:${hue(p.partId)}"/>`);
    if (part?.grain) {
      const cy = p.y + p.h - Math.min(40, p.h * 0.12);
      out.push(`<line x1="${p.x + p.w * 0.12}" y1="${cy}" x2="${p.x + p.w * 0.88}" y2="${cy}" class="grain"/>`);
    }
    const small = Math.min(p.w, p.h);
    const fs = Math.max(80, Math.min(130, small / 4.5));
    if (p.w >= fs * 4.2 && p.h >= fs * 1.7) {
      out.push(`<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fs * 0.1}" font-size="${fs}" class="lbl" text-anchor="middle">${p.w}×${p.h}</text>`);
      if (p.h >= fs * 3) {
        const nm = esc(p.name.length > 24 ? p.name.slice(0, 23) + "…" : p.name);
        out.push(`<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fs * 1.15}" font-size="${fs * 0.68}" class="lbl2" text-anchor="middle">${nm}</text>`);
      }
    }
  }
  out.push("</svg>");
  return out.join("");
}

export function cutSection(calc: CalcResult, dims: { length: number; width: number; trim: number }, parts: Part[]): string {
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const html: string[] = [];
  for (const g of calc.groups) {
    html.push(`<h3>${g.thickness} mm LDSP: ${g.pack.sheets.length} ta list, qoldiq ${fmt1(g.pack.waste)}%</h3>`);
    g.pack.sheets.forEach((s, i) => {
      const u = (s.usedArea / s.sheetArea) * 100;
      html.push(`<figure class="sheetbox"><figcaption>${i + 1}-list: ${s.placements.length} detal, foydalanish ${fmt1(u)}%, qoldiq ${fmt1(100 - u)}%</figcaption>${cutSheetSVG(s, dims, partsById)}</figure>`);
    });
    for (const u of g.pack.unplaced) html.push(`<p class="warn">Joylashtirilmadi: ${esc(u.name)} #${u.index}</p>`);
  }
  html.push(`<p class="muted">List ${dims.length}×${dims.width} mm. Kesimlar to'liq o'tadigan (guillotine) tartibda, arra qalinligi hisobga olingan. Chiziqli detallarda tola yo'nalishi belgilangan. Shtrixlangan joy qoldiq.</p>`);
  return html.join("");
}

// ------------------------------------------------------------ Yorliqlar (etiketka)

function edgeIcon(p: Part): string {
  const w = 76;
  const h = Math.max(24, Math.min(54, (p.width / p.length) * w * 1.6));
  const x = 6;
  const y = 6;
  const thick = (on: boolean) => (on ? `stroke="#000" stroke-width="4"` : `stroke="#999" stroke-width="1"`);
  const e = p.edge;
  return `<svg class="eico" viewBox="0 0 ${w + 12} ${h + 12}" aria-hidden="true">
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="none"/>
<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" ${thick(e.L1)}/><line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" ${thick(e.L2)}/>
<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" ${thick(e.W1)}/><line x1="${x + w}" y1="${y}" x2="${x + w}" y2="${y + h}" ${thick(e.W2)}/>
${p.grain ? `<line x1="${x + 10}" y1="${y + h / 2}" x2="${x + w - 10}" y2="${y + h / 2}" stroke="#777" stroke-width="1" stroke-dasharray="3 3"/>` : ""}
</svg>`;
}

/** Har bir detal nusxasi uchun bitta yorliq: raqam, nomi, o'lchami, kant, qaysi list */
export function labelsSection(calc: CalcResult, parts: Part[], title = ""): string {
  const sheetOf = new Map<string, string>();
  for (const g of calc.groups) {
    g.pack.sheets.forEach((sh, i) => {
      for (const pl of sh.placements) sheetOf.set(`${pl.partId}#${pl.index}`, `${g.thickness} mm, ${i + 1}-list`);
    });
  }
  let n = 0;
  const cards: string[] = [];
  for (const p of parts) {
    for (let i = 1; i <= p.qty; i++) {
      n++;
      const e = [p.edge.L1 && "U1", p.edge.L2 && "U2", p.edge.W1 && "E1", p.edge.W2 && "E2"].filter(Boolean).join(" ");
      const list = sheetOf.get(`${p.id}#${i}`) ?? sheetOf.get(`${p.id}#${i - 1}`) ?? "";
      cards.push(`<div class="lbl"><div class="lbl-n">${n}</div><div class="lbl-b"><b>${esc(p.name)}</b><span class="lbl-s">${p.length} × ${p.width} mm · ${p.thickness} mm</span><span>Kant: ${e || "yo'q"}${p.grain ? " · tola ↔" : ""}</span><span class="lbl-l">${esc(list)}${title ? " · " + esc(title) : ""}</span></div>${edgeIcon(p)}</div>`);
    }
  }
  return `<p class="muted">Jami ${n} ta yorliq. Qalin chiziq: kant yopishtiriladigan tomon. Chop etib, har bir detalga yopishtiring.</p><div class="lbls">${cards.join("")}</div>`;
}

// ------------------------------------------------------------ Material va narx

export function materialSection(calc: CalcResult, sheet: { length: number; width: number }, state: AppState): string {
  const rows: string[] = [];
  for (const g of calc.groups) {
    const price = state.prices.sheetByThickness[g.thickness] ?? 0;
    rows.push(
      `<tr><td>LDSP ${g.thickness} mm</td><td class="n">${g.pack.sheets.length} ta</td><td class="n">${fmt2((g.pack.sheets.length * sheet.length * sheet.width) / 1e6)} m²</td><td class="n">${price ? fmt(g.pack.sheets.length * price) : "-"}</td></tr>`,
    );
  }
  rows.push(
    `<tr><td>Kant lentasi</td><td class="n">${Math.ceil(calc.edge.withWaste)} m</td><td class="n">sof ${fmt1(calc.edge.net)} m</td><td class="n">${calc.cost.edge ? fmt(calc.cost.edge) : "-"}</td></tr>`,
  );
  if (calc.backPanel.m2 > 0) {
    rows.push(
      `<tr><td>DVP (orqa devor)</td><td class="n">${calc.backPanel.sheets} ta</td><td class="n">${fmt2(calc.backPanel.m2)} m²</td><td class="n">${calc.cost.backPanel ? fmt(calc.cost.backPanel) : "-"}</td></tr>`,
    );
  }
  const priced = calc.cost.total > 0;
  const costBlock = priced
    ? `<div class="costbox">
<div><span>Materiallar</span><b>${fmt(calc.cost.ldsp + calc.cost.edge + calc.cost.backPanel)}</b></div>
<div><span>Usta ish haqi</span><b>${fmt(calc.cost.labor)}</b></div>
<div><span>Foyda</span><b>${fmt(calc.cost.margin)}</b></div>
<div class="total"><span>Jami, so'm</span><b>${fmt(calc.cost.total)}</b></div></div>
<p class="muted">Furnitura, oyoq va stoleshnitsa narxi bu yerga kirmagan. Ularni alohida qo'shing.</p>`
    : `<p class="warn">Narxlar kiritilmagan. "Material va narxlar" bo'limida list, kant va DVP narxini kiriting.</p>`;
  return `<div class="tablewrap"><table><thead><tr><th>Material</th><th>Miqdor</th><th>Hajm</th><th>So'm</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>${costBlock}`;
}

// ------------------------------------------------------------ Furnitura va maslahat

export function furnitureSection(build: BuildResult): string {
  const rows = build.furniture
    .map((f) => `<tr><td>${esc(f.name)}${f.note ? `<div class="muted">${esc(f.note)}</div>` : ""}</td><td class="n">${fmt2(f.qty)} ${esc(f.unit)}</td></tr>`)
    .join("");
  return `<div class="tablewrap"><table><thead><tr><th>Nomi</th><th>Miqdor</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function adviceSection(calc: CalcResult, build: BuildResult): string {
  const items: string[] = [];
  for (const w of calc.warnings) items.push(`<li class="warn">${esc(w)}</li>`);
  for (const n of build.notes) items.push(`<li>${esc(n)}</li>`);
  for (const g of calc.groups) {
    if (g.pack.waste > 35 && g.pack.sheets.length > 0) {
      items.push(`<li>${g.thickness} mm: qoldiq ${fmt1(g.pack.waste)}%. Oxirgi list deyarli bo'sh bo'lsa, o'lcham yoki detal soniga ozgina o'zgartirish bilan bir list tejash mumkin.</li>`);
    }
  }
  if (!items.length) items.push("<li>Ogohlantirishlar yo'q.</li>");
  return `<ul class="advice">${items.join("")}</ul>
<p class="muted">Bu maslahatlar qoidalarga asoslangan, sun'iy intellekt emas. Birinchi buyurtmada o'zingiz qo'lda tekshirib ko'ring.</p>`;
}

// ------------------------------------------------------------ Chizma (jonli)

/** Sariq o'lchov lentasi ko'rinishidagi gorizontal o'lcham chizig'i. Koordinatalar mm. */
function tapeH(x1: number, x2: number, y: number, label: string, u: number): string {
  const h = u * 1.5;
  const ticks: string[] = [];
  for (let x = x1, i = 0; x <= x2 + 0.5; x += 100, i++) {
    const len = i % 5 === 0 ? h * 0.7 : h * 0.38;
    ticks.push(`M${x} ${y}v${len}`);
  }
  const pw = label.length * u * 1.05 + u * 1.6;
  const cx = (x1 + x2) / 2;
  return `<g class="tape"><rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" class="tapeband"/><path d="${ticks.join("")}" class="tick"/><rect x="${cx - pw / 2}" y="${y + h * 0.5 - u * 0.95}" width="${pw}" height="${u * 1.9}" rx="${u * 0.4}" class="pill"/><text x="${cx}" y="${y + h * 0.5 + u * 0.62}" font-size="${u * 1.7}" text-anchor="middle" class="tapetxt">${esc(label)}</text></g>`;
}

/** Vertikal lenta: pastdan yuqoriga (y2 pastki, y1 yuqori), x dan o'ngga qalinlik */
function tapeV(y1: number, y2: number, x: number, label: string, u: number): string {
  return `<g transform="translate(${x} ${y2}) rotate(-90)">${tapeH(0, y2 - y1, 0, label, u)}</g>`;
}

function nikelLegs(x: number, y: number, W: number, h: number, count: number, u: number): string {
  // Old ko'rinishda ko'rinadigan oyoqlar: 4 -> 2 ta, 6 -> 3 ta
  const visible = count >= 6 ? 3 : 2;
  const w = Math.max(22, u * 0.55);
  const inset = Math.min(60, W * 0.06);
  const xs = visible === 3 ? [x + inset, x + W / 2 - w / 2, x + W - inset - w] : [x + inset, x + W - inset - w];
  return xs.map((px) => `<rect x="${px}" y="${y}" width="${w}" height="${h}" class="legn"/><rect x="${px - w * 0.6}" y="${y}" width="${w * 2.2}" height="${Math.min(14, h * 0.15)}" class="legfoot"/>`).join("");
}

function frontCabinet(o: {
  x: number;
  y: number;
  W: number;
  H: number;
  t: number;
  legH: number;
  legType: "yoq" | "tsokol" | "nikel";
  shelves: number;
  doors: number;
  sliding: number;
  drawers: number;
  rods: number;
  color: string;
  profil: boolean;
  u: number;
}): string {
  const { x, y, W, H, t, legH, legType, shelves, doors, sliding, drawers, rods, color, profil, u } = o;
  const fill = `style="fill:${color}"`;
  const bodyH = H - legH;
  const g: string[] = [];
  g.push(`<rect x="${x}" y="${y}" width="${W}" height="${bodyH}" class="wood"/>`);
  g.push(`<rect x="${x + t}" y="${y + t}" width="${W - 2 * t}" height="${bodyH - 2 * t}" class="woodin"/>`);
  const innerH = bodyH - 2 * t;
  // O'rta bokovoylar, osma (shtanga) va javonli bo'limlar, tortmalar
  const nd = dividerCount(W - 2 * t, shelves > 0);
  const secW = (W - 2 * t - nd * t) / (nd + 1);
  const secX = (k: number) => x + t + k * (secW + t);
  for (let k = 1; k <= nd; k++) g.push(`<rect x="${secX(k) - t}" y="${y + t}" width="${t}" height="${innerH}" class="wood"/>`);
  const plan = sectionPlan(nd + 1, shelves, rods, drawers);
  const dh = drawers > 0 ? Math.min(180, innerH / (drawers + 1)) : 0;
  plan.forEach((role, k) => {
    const dzone = role.drawers > 0 ? role.drawers * (dh + 4) + 3 : 0;
    const floorY = y + bodyH - t;
    for (const sy of shelfYs(0, innerH - dzone, role.shelves, t)) {
      g.push(`<rect x="${secX(k)}" y="${floorY - dzone - sy - t}" width="${secW}" height="${t}" class="shelf"/>`);
    }
    if (role.rod) g.push(`<line x1="${secX(k) + 10}" y1="${y + t + 140}" x2="${secX(k) + secW - 10}" y2="${y + t + 140}" class="rodl"/>`);
    for (let i = 0; i < role.drawers; i++) {
      const dy = floorY - 3 - (i + 1) * (dh + 4) + 4;
      g.push(`<rect x="${secX(k) + 3}" y="${dy}" width="${secW - 6}" height="${dh}" class="door" ${fill}/><line x1="${secX(k) + secW / 2 - 60}" y1="${dy + dh / 2}" x2="${secX(k) + secW / 2 + 60}" y2="${dy + dh / 2}" class="handle"/>`);
    }
  });
  const dH = bodyH - 6;
  if (doors > 0) {
    const gap = 3;
    const dw = (W - gap * (doors + 1)) / doors;
    for (let i = 0; i < doors; i++) {
      const dx = x + gap + i * (dw + gap);
      g.push(`<rect x="${dx}" y="${y + gap}" width="${dw}" height="${dH}" class="door" ${fill}/>`);
      if (profil) {
        const hx = doors === 1 || i % 2 === 0 ? dx + dw - 10 : dx + 10;
        g.push(`<line x1="${hx}" y1="${y + gap + 20}" x2="${hx}" y2="${y + gap + dH - 20}" class="handle"/>`);
      } else {
        const hx = doors === 1 ? dx + dw - 45 : i % 2 === 0 ? dx + dw - 45 : dx + 45;
        const hy = y + gap + dH / 2;
        g.push(`<line x1="${hx}" y1="${hy - 70}" x2="${hx}" y2="${hy + 70}" class="handle"/>`);
      }
    }
  }
  if (sliding > 0) {
    const overlap = 30;
    const dw = (W - 2 * t + overlap * (sliding - 1)) / sliding;
    for (let i = 0; i < sliding; i++) {
      const dx = x + t + i * (dw - overlap);
      g.push(`<rect x="${dx}" y="${y + t}" width="${dw}" height="${bodyH - 2 * t}" class="door ${i % 2 ? "back" : ""}" ${fill}/>`);
      // Ruchka o'rniga alyuminiy ramka profili
      const bar = Math.max(14, u * 0.45);
      g.push(`<rect x="${dx}" y="${y + t}" width="${bar}" height="${bodyH - 2 * t}" class="legn"/><rect x="${dx + dw - bar}" y="${y + t}" width="${bar}" height="${bodyH - 2 * t}" class="legn"/>`);
    }
    // Yuqori va pastki rels
    g.push(`<rect x="${x + t}" y="${y + t}" width="${W - 2 * t}" height="${Math.max(10, u * 0.35)}" class="legn"/><rect x="${x + t}" y="${y + bodyH - t - Math.max(10, u * 0.35)}" width="${W - 2 * t}" height="${Math.max(10, u * 0.35)}" class="legn"/>`);
  }
  if (legH > 0) {
    if (legType === "tsokol") g.push(`<rect x="${x}" y="${y + bodyH}" width="${W}" height="${legH - 3}" class="tsokol"/>`);
    else if (legType === "nikel") g.push(nikelLegs(x, y + bodyH, W, legH, legCountFor(W), u));
  }
  return g.join("");
}

function svgWrap(vw: number, vh: number, inner: string): string {
  return `<svg class="draw" viewBox="0 0 ${Math.round(vw)} ${Math.round(vh)}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
}

export function drawingSVG(state: AppState): string {
  switch (state.type) {
    case "shkaf":
    case "kupe": {
      const p = state.params[state.type];
      const S = Math.max(p.width, p.height);
      const u = S / 42;
      const x0 = u * 3.6;
      const y0 = u * 1.2;
      const legH = legHeightOf(p);
      const A = state.type === "kupe" ? state.params.kupe.antresol : 0;
      let antresolSvg = "";
      if (A > 0) {
        const dn = Math.max(2, Math.ceil(p.width / 450));
        const dw = (p.width - 3 * (dn + 1)) / dn;
        antresolSvg = `<rect x="${x0}" y="${y0}" width="${p.width}" height="${A}" class="wood"/>`;
        for (let i = 0; i < dn; i++) {
          const dx = x0 + 3 + i * (dw + 3);
          antresolSvg += `<rect x="${dx}" y="${y0 + 3}" width="${dw}" height="${A - 6}" class="door" style="fill:${finishHex(p.color)}"/><line x1="${i % 2 === 0 ? dx + dw - 28 : dx + 28}" y1="${y0 + A - 40}" x2="${i % 2 === 0 ? dx + dw - 28 : dx + 28}" y2="${y0 + A - 40 - Math.min(110, A * 0.5)}" class="handle"/>`;
        }
      }
      const body = antresolSvg + frontCabinet({
        x: x0,
        y: y0 + A,
        W: p.width,
        H: p.height - A,
        t: p.thickness,
        legH,
        legType: p.legType,
        shelves: p.shelves,
        doors: state.type === "shkaf" ? state.params.shkaf.doors : 0,
        sliding: state.type === "kupe" ? state.params.kupe.sliding : 0,
        drawers: p.drawers,
        rods: p.rods,
        color: finishHex(p.color),
        profil: state.type === "shkaf" && state.params.shkaf.handles === "profil",
        u,
      });
      const floorY = y0 + p.height;
      const floor = `<line x1="${x0 - u}" y1="${floorY}" x2="${x0 + p.width + u}" y2="${floorY}" class="floor"/>`;
      const legTag = legH > 0 ? `<text x="${x0 - u * 0.6}" y="${floorY - legH / 2 + u * 0.45}" font-size="${u * 1.4}" text-anchor="end" class="mini">${legH}</text>` : "";
      return svgWrap(
        p.width + u * 10.6,
        p.height + u * 5.2,
        `${body}${floor}${legTag}${tapeH(x0, x0 + p.width, floorY + u * 1.2, `${p.width}`, u)}${tapeV(y0, floorY, x0 + p.width + u * 1.6, `${p.height}`, u)}`,
      );
    }
    case "oshxona": {
      const k = state.params.oshxona;
      const legH = legHeightOf(k);
      const lowerMods = k.modules.filter((m) => m.kind !== "yuqori");
      const wallMods = k.modules.filter((m) => m.kind === "yuqori");
      const lowerW = lowerMods.reduce((q, m) => q + m.width, 0);
      const wallW = wallMods.reduce((q, m) => q + m.width, 0);
      let leading = 0;
      for (const m of lowerMods) {
        if (m.kind === "penal") leading += m.width;
        else break;
      }
      const rowW = Math.max(lowerW, leading + wallW, 600);
      const gapMid = 550;
      const hasWall = wallMods.length > 0;
      const hasTall = lowerMods.some((m) => m.kind === "penal");
      const stdH = (hasWall ? k.wallHeight + gapMid : 0) + legH + k.baseHeight + 38;
      const totalH = Math.max(stdH, hasTall ? k.tallHeight : 0);
      const u = Math.max(rowW, totalH) / 42;
      const x0 = u * 1.5;
      const y0 = u * 1.2;
      const floorY = y0 + totalH;
      const up = finishHex(k.upperColor);
      const low = finishHex(k.lowerColor);
      const profil = k.handles === "profil";
      const g: string[] = [];
      const draw = (m: KitchenModule, x: number, top: number, h: number, color: string, kind: "base" | "wall" | "tall") => {
        g.push(`<rect x="${x}" y="${top}" width="${m.width}" height="${h}" class="wood"/>`);
        const slot = (px: number, py: number, w: number, hh: number, i: number) => {
          if (profil) {
            if (kind === "tall") {
              const hx = i % 2 === 0 ? px + w - 10 : px + 10;
              g.push(`<line x1="${hx}" y1="${py + 16}" x2="${hx}" y2="${py + hh - 16}" class="handle"/>`);
            } else {
              const ly = kind === "base" ? py + 10 : py + hh - 10;
              g.push(`<line x1="${px + 8}" y1="${ly}" x2="${px + w - 8}" y2="${ly}" class="handle"/>`);
            }
          } else {
            const hx = i % 2 === 0 ? px + w - 28 : px + 28;
            const hy = kind === "base" ? py + 20 : kind === "wall" ? py + hh - 120 : py + hh / 2 - 90;
            g.push(`<line x1="${hx}" y1="${hy}" x2="${hx}" y2="${hy + 100}" class="handle"/>`);
          }
        };
        if (m.doors > 0) {
          const dw = m.width / m.doors;
          for (let i = 0; i < m.doors; i++) {
            const px = x + i * dw + 3;
            g.push(`<rect x="${px}" y="${top + 3}" width="${dw - 6}" height="${h - 6}" class="door" style="fill:${color}"/>`);
            slot(px, top + 3, dw - 6, h - 6, i);
          }
        }
        if (m.drawers > 0) {
          const dh = h / m.drawers;
          for (let i = 0; i < m.drawers; i++) {
            const py = top + i * dh + 3;
            g.push(`<rect x="${x + 3}" y="${py}" width="${m.width - 6}" height="${dh - 6}" class="door" style="fill:${color}"/>`);
            const ly = py + (profil ? 10 : 22);
            const half = profil ? (m.width - 22) / 2 : 70;
            g.push(`<line x1="${x + m.width / 2 - half}" y1="${ly}" x2="${x + m.width / 2 + half}" y2="${ly}" class="handle"/>`);
          }
        }
        g.push(`<text x="${x + m.width / 2}" y="${top + h / 2 + u * 0.6}" font-size="${u * 1.5}" text-anchor="middle" class="mini">${m.width}</text>`);
      };
      const wallTop = floorY - stdH;
      const baseTop = floorY - legH - k.baseHeight;
      let wx = x0 + leading;
      for (const m of wallMods) {
        draw(m, wx, wallTop, k.wallHeight, up, "wall");
        wx += m.width;
      }
      let x = x0;
      for (const m of lowerMods) {
        if (m.kind === "penal") {
          draw(m, x, floorY - k.tallHeight, k.tallHeight - legH, low, "tall");
        } else {
          draw(m, x, baseTop, k.baseHeight, low, "base");
          g.push(`<rect x="${x - 6}" y="${baseTop - 38}" width="${m.width + 12}" height="38" class="counter"/>`);
        }
        if (legH > 0) {
          if (k.legType === "tsokol") g.push(`<rect x="${x}" y="${floorY - legH}" width="${m.width}" height="${legH - 3}" class="tsokol"/>`);
          else g.push(nikelLegs(x, floorY - legH, m.width, legH, legCountFor(m.width), u));
        }
        x += m.width;
      }
      g.push(`<line x1="${x0 - u}" y1="${floorY}" x2="${x0 + rowW + u}" y2="${floorY}" class="floor"/>`);
      g.push(tapeH(x0, x0 + rowW, floorY + u * 1.2, `${rowW}`, u));
      return svgWrap(rowW + u * 5, totalH + u * 5.2, g.join(""));
    }
    case "krovat": {
      const k = state.params.krovat;
      const innerW = k.mattressWidth + 20;
      const innerL = k.mattressLength + 20;
      const W = innerW + 2 * k.thickness;
      const L = innerL + 2 * k.thickness;
      const u = Math.max(W, L) / 42;
      const x0 = u * 2.2;
      const y0 = u * 3;
      const g: string[] = [];
      if (k.headboard > 0) g.push(`<rect x="${x0 - u}" y="${y0 - u * 1.6}" width="${W + 2 * u}" height="${u * 1.4}" class="shelf"/>`);
      g.push(`<rect x="${x0}" y="${y0}" width="${W}" height="${L}" class="wood"/>`);
      g.push(`<rect x="${x0 + k.thickness}" y="${y0 + k.thickness}" width="${innerW}" height="${innerL}" class="woodin"/>`);
      // lamellar
      for (let y = y0 + k.thickness + 45; y < y0 + k.thickness + innerL - 20; y += 90) {
        g.push(`<line x1="${x0 + k.thickness}" y1="${y}" x2="${x0 + k.thickness + innerW}" y2="${y}" class="slat"/>`);
      }
      g.push(`<rect x="${x0 + k.thickness + 40}" y="${y0 + k.thickness + 40}" width="${innerW - 80}" height="${innerL - 80}" class="mattress" rx="${u * 0.8}"/>`);
      g.push(`<text x="${x0 + W / 2}" y="${y0 + L / 2 + u * 0.7}" font-size="${u * 1.8}" text-anchor="middle" class="mini">${k.mattressWidth} × ${k.mattressLength}</text>`);
      // oyoqlar (burchaklar)
      const ls = u * 1.1;
      const corners: [number, number][] = [[x0 + 8, y0 + 8], [x0 + W - ls - 8, y0 + 8], [x0 + 8, y0 + L - ls - 8], [x0 + W - ls - 8, y0 + L - ls - 8]];
      for (const [cx, cy] of corners) g.push(`<rect x="${cx}" y="${cy}" width="${ls}" height="${ls}" class="${k.legType === "nikel" ? "legn" : "legw"}"/>`);
      g.push(tapeH(x0, x0 + W, y0 + L + u * 1.2, `${W}`, u));
      g.push(tapeV(y0, y0 + L, x0 + W + u * 1.6, `${L}`, u));
      return svgWrap(W + u * 8.5, L + u * 7.5, g.join(""));
    }
    case "divan": {
      const d = state.params.divan;
      const S = Math.max(d.length, d.backHeight);
      const u = S / 42;
      const x0 = u * 1.5;
      const y0 = u * 1.2;
      const g: string[] = [];
      const frameH = Math.max(100, d.seatHeight - d.legHeight);
      const arm = 170;
      const floorY = y0 + d.backHeight;
      const seatTop = floorY - d.seatHeight;
      // suyanchiq
      g.push(`<rect x="${x0 + arm}" y="${y0}" width="${d.length - 2 * arm}" height="${d.backHeight - d.seatHeight + 140}" class="mattress" rx="${u}"/>`);
      // qo'ltiqlar
      g.push(`<rect x="${x0}" y="${y0 + (d.backHeight - d.seatHeight) * 0.45}" width="${arm}" height="${d.seatHeight + (d.backHeight - d.seatHeight) * 0.55 - d.legHeight}" class="wood"/>`);
      g.push(`<rect x="${x0 + d.length - arm}" y="${y0 + (d.backHeight - d.seatHeight) * 0.45}" width="${arm}" height="${d.seatHeight + (d.backHeight - d.seatHeight) * 0.55 - d.legHeight}" class="wood"/>`);
      // o'rindiq (yostiq) va karkas
      g.push(`<rect x="${x0 + arm}" y="${seatTop}" width="${d.length - 2 * arm}" height="140" class="mattress" rx="${u * 0.7}"/>`);
      g.push(`<rect x="${x0 + arm}" y="${seatTop + 140}" width="${d.length - 2 * arm}" height="${Math.max(40, frameH - 140)}" class="wood"/>`);
      // oyoqlar
      const lw = Math.max(40, u * 0.9);
      const cls = d.legType === "nikel" ? "legn" : "legw";
      for (const lx of [x0 + 30, x0 + d.length - 30 - lw]) g.push(`<rect x="${lx}" y="${floorY - d.legHeight}" width="${lw}" height="${d.legHeight}" class="${cls}"/>`);
      g.push(`<line x1="${x0 - u}" y1="${floorY}" x2="${x0 + d.length + u}" y2="${floorY}" class="floor"/>`);
      g.push(tapeH(x0, x0 + d.length, floorY + u * 1.2, `${d.length}`, u));
      g.push(tapeV(y0, floorY, x0 + d.length + u * 1.6, `${d.backHeight}`, u));
      return svgWrap(d.length + u * 8.5, d.backHeight + u * 5.2, g.join(""));
    }
  }
}

export const elevationSVG = drawingSVG;

export function describeState(state: AppState): string {
  if (state.type === "oshxona") {
    const m = state.params.oshxona.modules;
    const len = m.filter((x) => x.kind !== "yuqori").reduce((s, x) => s + x.width, 0);
    return `${m.length} modul, pastki qator ${len} mm`;
  }
  const p = state.params[state.type] as unknown as Record<string, number>;
  if (state.type === "krovat") return `matras ${p.mattressWidth} × ${p.mattressLength} mm`;
  if (state.type === "divan") return `${p.length} × ${p.depth} × ${p.backHeight} mm`;
  return `${p.width} × ${p.height} × ${p.depth} mm`;
}
