import type { CalcResult } from "../core/calculator.ts";
import type { BuildResult, FurnitureType, KitchenModule } from "../core/templates.ts";
import type { PackedSheet, Part } from "../core/types.ts";
import type { AppState } from "./forms.ts";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const fmt = (n: number): string => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toString();
export const fmt2 = (n: number): string => (Math.round(n * 100) / 100).toString();

// ------------------------------------------------------------ Umumiy kartalar

export function summaryCards(calc: CalcResult, sheetArea: number): string {
  const sheets = calc.groups.reduce((s, g) => s + g.pack.sheets.length, 0);
  const area = (sheets * sheetArea) / 1e6;
  const util = calc.groups.length
    ? calc.groups.reduce((s, g) => s + g.pack.totalUsedArea, 0) /
      Math.max(1, calc.groups.reduce((s, g) => s + g.pack.totalSheetArea, 0)) *
      100
    : 0;
  const cards = [
    { v: `${sheets} ta`, l: "LDSP listlar", s: `${fmt2(area)} m²` },
    { v: `${fmt1(100 - util)}%`, l: "Qoldiq", s: `foydalanish ${fmt1(util)}%` },
    { v: `${fmt1(calc.edge.withWaste)} m`, l: "Kant", s: `sof ${fmt1(calc.edge.net)} m` },
    { v: calc.backPanel.sheets ? `${calc.backPanel.sheets} ta` : "—", l: "DVP list", s: `${fmt2(calc.backPanel.m2)} m²` },
  ];
  return cards
    .map((c) => `<div class="card stat"><div class="stat-v">${esc(c.v)}</div><div class="stat-l">${esc(c.l)}</div><div class="stat-s">${esc(c.s)}</div></div>`)
    .join("");
}

// ------------------------------------------------------------ Kesim jadvali

export function partsTable(parts: Part[]): string {
  const rows = parts
    .map((p) => {
      const e = [p.edge.L1 && "U1", p.edge.L2 && "U2", p.edge.W1 && "E1", p.edge.W2 && "E2"].filter(Boolean).join(" ");
      return `<tr><td>${esc(p.name)}</td><td class="n">${p.length}</td><td class="n">${p.width}</td><td class="n">${p.qty}</td><td class="n">${p.thickness}</td><td>${p.grain ? "↔ tola" : ""}</td><td>${e || "—"}</td></tr>`;
    })
    .join("");
  return `<div class="tablewrap"><table><thead><tr><th>Detal</th><th>Uzun</th><th>Eni</th><th>Soni</th><th>mm</th><th>Tekstura</th><th>Kant</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="muted">Kant: U = uzun tomon, E = qisqa tomon. "↔ tola" — aylantirib bo'lmaydi. O'lchamlar mm.</p>`;
}

// ------------------------------------------------------------ Raskroy (kesim sxemasi)

function hue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function cutSheetSVG(
  sheet: PackedSheet,
  dims: { length: number; width: number; trim: number },
  partsById: Map<string, Part>,
): string {
  const { length: L, width: W, trim } = dims;
  const out: string[] = [];
  out.push(`<svg class="cut" viewBox="0 0 ${L} ${W}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  out.push(`<rect x="0" y="0" width="${L}" height="${W}" class="sheet"/>`);
  if (trim > 0) out.push(`<rect x="${trim}" y="${trim}" width="${L - 2 * trim}" height="${W - 2 * trim}" class="trim"/>`);
  for (const p of sheet.placements) {
    const part = partsById.get(p.partId);
    const h = hue(p.partId);
    out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" class="piece" style="fill:hsl(${h} 55% 38%)"/>`);
    if (part?.grain) {
      // tekstura yo'nalishi: list uzunligi bo'ylab chiziq
      const cy = p.y + p.h / 2;
      out.push(`<line x1="${p.x + p.w * 0.15}" y1="${cy}" x2="${p.x + p.w * 0.85}" y2="${cy}" class="grain"/>`);
    }
    const small = Math.min(p.w, p.h);
    const fs = Math.max(24, Math.min(64, small / 5));
    if (small >= 90 && p.w >= fs * 4) {
      const label = `${p.w}×${p.h}`;
      out.push(`<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - fs * 0.15}" font-size="${fs}" class="lbl" text-anchor="middle">${label}</text>`);
      if (p.h >= fs * 3.2) {
        const nm = esc(p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name);
        out.push(`<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fs * 0.95}" font-size="${fs * 0.7}" class="lbl2" text-anchor="middle">${nm}</text>`);
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
    html.push(`<h3>${g.thickness} mm LDSP — ${g.pack.sheets.length} ta list, qoldiq ${fmt1(g.pack.waste)}%</h3>`);
    g.pack.sheets.forEach((s, i) => {
      const u = (s.usedArea / s.sheetArea) * 100;
      html.push(`<div class="sheetbox"><div class="sheethead">List ${i + 1}: ${s.placements.length} detal · foydalanish ${fmt1(u)}% · qoldiq ${fmt1(100 - u)}%</div>${cutSheetSVG(s, dims, partsById)}</div>`);
    });
    for (const u of g.pack.unplaced) html.push(`<p class="warn">Joylashtirilmadi: ${esc(u.name)} #${u.index}</p>`);
  }
  html.push(`<p class="muted">List ${dims.length}×${dims.width} mm. Kesimlar guillotine (to'liq o'tadigan) tartibda, arra qalinligi hisobga olingan. Chiziqli detallarda tola yo'nalishi belgilangan.</p>`);
  return html.join("");
}

// ------------------------------------------------------------ Material va narx

export function materialSection(calc: CalcResult, sheet: { length: number; width: number }, state: AppState): string {
  const rows: string[] = [];
  for (const g of calc.groups) {
    const price = state.prices.sheetByThickness[g.thickness] ?? 0;
    rows.push(
      `<tr><td>LDSP ${g.thickness} mm</td><td class="n">${g.pack.sheets.length} ta</td><td class="n">${fmt2((g.pack.sheets.length * sheet.length * sheet.width) / 1e6)} m²</td><td class="n">${price ? fmt(g.pack.sheets.length * price) : "—"}</td></tr>`,
    );
  }
  rows.push(
    `<tr><td>Kant lentasi</td><td class="n">${Math.ceil(calc.edge.withWaste)} m</td><td class="n">sof ${fmt1(calc.edge.net)} m</td><td class="n">${calc.cost.edge ? fmt(calc.cost.edge) : "—"}</td></tr>`,
  );
  if (calc.backPanel.m2 > 0) {
    rows.push(
      `<tr><td>DVP (orqa devor)</td><td class="n">${calc.backPanel.sheets} ta</td><td class="n">${fmt2(calc.backPanel.m2)} m²</td><td class="n">${calc.cost.backPanel ? fmt(calc.cost.backPanel) : "—"}</td></tr>`,
    );
  }
  const priced = calc.cost.total > 0;
  const costBlock = priced
    ? `<div class="costbox">
<div><span>Materiallar</span><b>${fmt(calc.cost.ldsp + calc.cost.edge + calc.cost.backPanel)}</b></div>
<div><span>Usta ish haqi</span><b>${fmt(calc.cost.labor)}</b></div>
<div><span>Foyda</span><b>${fmt(calc.cost.margin)}</b></div>
<div class="total"><span>Jami (so'm)</span><b>${fmt(calc.cost.total)}</b></div></div>
<p class="muted">Furnitura va stoleshnitsa narxi bu yerga kirmagan — ularni alohida qo'shing.</p>`
    : `<p class="warn">Narxlar kiritilmagan. "Narxlar" bo'limida list, kant va DVP narxini kiriting.</p>`;
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
<p class="muted">Bu hisob qoidalarga asoslangan (AI emas). Birinchi buyurtmada o'zingiz qo'lda tekshirib ko'ring va kerak bo'lsa o'lcham/sozlamalarni o'zgartiring.</p>`;
}

// ------------------------------------------------------------ Chizma (old ko'rinish)

type Dim = { x1: number; y1: number; x2: number; y2: number; text: string };

function dimLineH(x1: number, x2: number, y: number, text: string): string {
  return `<g class="dim"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 12}" x2="${x1}" y2="${y + 12}"/><line x1="${x2}" y1="${y - 12}" x2="${x2}" y2="${y + 12}"/><text x="${(x1 + x2) / 2}" y="${y + 52}" text-anchor="middle">${esc(text)}</text></g>`;
}
function dimLineV(y1: number, y2: number, x: number, text: string): string {
  const cy = (y1 + y2) / 2;
  return `<g class="dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x - 12}" y1="${y1}" x2="${x + 12}" y2="${y1}"/><line x1="${x - 12}" y1="${y2}" x2="${x + 12}" y2="${y2}"/><text transform="translate(${x + 52} ${cy}) rotate(-90)" text-anchor="middle">${esc(text)}</text></g>`;
}

function svgWrap(vw: number, vh: number, inner: string): string {
  return `<svg class="draw" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
}

function cabinetFront(
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  shelves: number,
  doors: number,
  sliding: number,
  plinth: number,
): string {
  const o: string[] = [];
  const bodyH = h - plinth;
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${bodyH}" class="body"/>`);
  o.push(`<rect x="${x + t}" y="${y + t}" width="${w - 2 * t}" height="${bodyH - 2 * t}" class="inner"/>`);
  const innerH = bodyH - 2 * t;
  for (let i = 1; i <= shelves; i++) {
    const sy = y + t + (innerH * i) / (shelves + 1) - t / 2;
    o.push(`<rect x="${x + t}" y="${sy}" width="${w - 2 * t}" height="${t}" class="shelf"/>`);
  }
  if (plinth > 0) {
    o.push(`<rect x="${x + 40}" y="${y + bodyH}" width="30" height="${plinth}" class="leg"/>`);
    o.push(`<rect x="${x + w - 70}" y="${y + bodyH}" width="30" height="${plinth}" class="leg"/>`);
  }
  if (doors > 0) {
    const gap = 3;
    const dw = (w - gap * (doors + 1)) / doors;
    for (let i = 0; i < doors; i++) {
      const dx = x + gap + i * (dw + gap);
      o.push(`<rect x="${dx}" y="${y + gap}" width="${dw}" height="${bodyH - 2 * gap}" class="door"/>`);
      const hx = i % 2 === 0 ? dx + dw - 40 : dx + 40;
      o.push(`<line x1="${hx}" y1="${y + bodyH / 2 - 70}" x2="${hx}" y2="${y + bodyH / 2 + 70}" class="handle"/>`);
    }
  }
  if (sliding > 0) {
    const overlap = 30;
    const dw = (w - 2 * t + overlap * (sliding - 1)) / sliding;
    for (let i = 0; i < sliding; i++) {
      const dx = x + t + i * (dw - overlap);
      o.push(`<rect x="${dx}" y="${y + t}" width="${dw}" height="${bodyH - 2 * t}" class="door ${i % 2 ? "back" : ""}"/>`);
    }
  }
  return o.join("");
}

export function elevationSVG(state: AppState): string {
  const pad = 140;
  switch (state.type) {
    case "shkaf":
    case "kupe": {
      const p = state.params[state.type];
      const sliding = state.type === "kupe" ? state.params.kupe.sliding : 0;
      const doors = state.type === "shkaf" ? state.params.shkaf.doors : 0;
      const inner = cabinetFront(pad, pad, p.width, p.height, p.thickness, p.shelves, doors, sliding, p.plinth);
      return svgWrap(
        p.width + pad * 2 + 120,
        p.height + pad * 2 + 60,
        `<text x="${pad}" y="70" class="cap">OLD KO'RINISH · chuqurlik ${p.depth} mm</text>${inner}${dimLineH(pad, pad + p.width, pad + p.height + 60, `${p.width} mm`)}${dimLineV(pad, pad + p.height, pad + p.width + 60, `${p.height} mm`)}`,
      );
    }
    case "oshxona": {
      const k = state.params.oshxona;
      const baseW = k.modules.filter((m) => m.kind === "past").reduce((s, m) => s + m.width, 0);
      const wallW = k.modules.filter((m) => m.kind === "yuqori").reduce((s, m) => s + m.width, 0);
      const total = Math.max(baseW, wallW, 600);
      const rowTop = pad;
      const wallY = rowTop;
      const gapMid = 550; // ish yuzasi oralig'i (taxminiy, chizma uchun)
      const baseY = wallY + k.wallHeight + gapMid;
      const o: string[] = [`<text x="${pad}" y="70" class="cap">OLD KO'RINISH (modullar)</text>`];
      const drawRow = (mods: KitchenModule[], y: number, h: number) => {
        let x = pad;
        for (const m of mods) {
          o.push(`<rect x="${x}" y="${y}" width="${m.width}" height="${h}" class="body"/>`);
          if (m.doors > 0) {
            const dw = m.width / m.doors;
            for (let i = 0; i < m.doors; i++) o.push(`<rect x="${x + i * dw + 3}" y="${y + 3}" width="${dw - 6}" height="${h - 6}" class="door"/>`);
          }
          if (m.drawers > 0) {
            const dh = h / m.drawers;
            for (let i = 0; i < m.drawers; i++) o.push(`<rect x="${x + 3}" y="${y + i * dh + 3}" width="${m.width - 6}" height="${dh - 6}" class="door"/>`);
          }
          o.push(`<text x="${x + m.width / 2}" y="${y + h + 40}" text-anchor="middle" class="mini">${m.width}</text>`);
          x += m.width;
        }
      };
      drawRow(k.modules.filter((m) => m.kind === "yuqori"), wallY, k.wallHeight);
      drawRow(k.modules.filter((m) => m.kind === "past"), baseY, k.baseHeight);
      const bottom = baseY + k.baseHeight + k.plinth;
      o.push(`<rect x="${pad}" y="${baseY + k.baseHeight}" width="${baseW}" height="${k.plinth}" class="leg"/>`);
      return svgWrap(total + pad * 2, bottom + 140, o.join(""));
    }
    case "krovat": {
      const k = state.params.krovat;
      const innerW = k.mattressWidth + 20;
      const innerL = k.mattressLength + 20;
      const W = innerW + 2 * k.thickness;
      const L = innerL + 2 * k.thickness;
      const o: string[] = [`<text x="${pad}" y="70" class="cap">YUQORIDAN KO'RINISH</text>`];
      o.push(`<rect x="${pad}" y="${pad}" width="${W}" height="${L}" class="body"/>`);
      o.push(`<rect x="${pad + k.thickness}" y="${pad + k.thickness}" width="${innerW}" height="${innerL}" class="door"/>`);
      if (k.headboard > 0) o.push(`<rect x="${pad - 20}" y="${pad - 50}" width="${W + 40}" height="40" class="shelf"/>`);
      o.push(`<text x="${pad + W / 2}" y="${pad + L / 2}" text-anchor="middle" class="mini">matras ${k.mattressWidth}×${k.mattressLength}</text>`);
      o.push(dimLineH(pad, pad + W, pad + L + 60, `${W} mm`));
      o.push(dimLineV(pad, pad + L, pad + W + 60, `${L} mm`));
      return svgWrap(W + pad * 2 + 120, L + pad * 2 + 60, o.join(""));
    }
    case "divan": {
      const d = state.params.divan;
      const o: string[] = [`<text x="${pad}" y="70" class="cap">OLD KO'RINISH (taxminiy)</text>`];
      const armW = 160;
      o.push(`<rect x="${pad}" y="${pad + (d.backHeight - d.seatHeight) + 150}" width="${d.length}" height="${d.seatHeight - 150}" class="body"/>`);
      o.push(`<rect x="${pad + armW}" y="${pad}" width="${d.length - 2 * armW}" height="${d.backHeight - 150 + 150 - 150}" class="door"/>`);
      o.push(`<rect x="${pad}" y="${pad + 150}" width="${armW}" height="${d.backHeight - 150}" class="body"/>`);
      o.push(`<rect x="${pad + d.length - armW}" y="${pad + 150}" width="${armW}" height="${d.backHeight - 150}" class="body"/>`);
      o.push(dimLineH(pad, pad + d.length, pad + d.backHeight + 60, `${d.length} mm`));
      o.push(dimLineV(pad, pad + d.backHeight, pad + d.length + 60, `${d.backHeight} mm`));
      return svgWrap(d.length + pad * 2 + 120, d.backHeight + pad * 2 + 60, o.join(""));
    }
  }
}

export function typeTitle(type: FurnitureType): string {
  return { shkaf: "Shkaf", kupe: "Kupe", oshxona: "Oshxona garnituri", krovat: "Krovat", divan: "Divan" }[type];
}
