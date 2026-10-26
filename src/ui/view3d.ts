// Kutubxonasiz 3D ko'rinish: mebel to'g'ri burchakli bo'laklardan (box) yig'iladi, SVG'da chiziladi.
// Orqada turgan bo'laklar oldin chiziladi (ressomlar usuli), tartib har bir juft bo'lak orasidagi
// ajratuvchi tekislik bo'yicha aniqlanadi, shuning uchun istalgan burchakdan to'g'ri chiqadi.
import { dividerCount, legCountFor, legHeightOf, sectionPlan, shelfYs } from "../core/templates.ts";
import type { AppState } from "./forms.ts";

export type Mat = "body" | "back" | "door" | "leg" | "tsokol" | "counter" | "mattress" | "fabric" | "handle" | "wood" | "alu" | "fartuk";

export type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; mat: Mat };
export type View = { yaw: number; pitch: number };
export type Scene = { boxes: Box[] };

const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: Mat): Box => ({ x0, x1, y0, y1, z0, z1, mat });

/** x: eni (o'ngga), y: balandlik (yuqoriga), z: chuqurlik (kuzatuvchi tomonga; old tomon = katta z) */
export function buildScene(state: AppState, opts: { inside?: boolean } = {}): Scene {
  const inside = !!opts.inside;
  const B: Box[] = [];

  switch (state.type) {
    case "shkaf":
    case "kupe": {
      const p = state.params[state.type];
      const W = p.width;
      const H = p.height;
      const D = p.depth;
      const t = p.thickness;
      const lh = legHeightOf(p);
      const innerH = H - lh - 2 * t;
      B.push(bx(0, t, lh, H, 0, D, "body"), bx(W - t, W, lh, H, 0, D, "body"));
      B.push(bx(t, W - t, H - t, H, 0, D, "body"), bx(t, W - t, lh, lh + t, 0, D, "body"));
      B.push(bx(t, W - t, lh + t, H - t, 0, 4, "back"));
      const innerW = W - 2 * t;
      const nd = dividerCount(innerW, p.shelves > 0);
      const secW = (innerW - nd * t) / (nd + 1);
      const secX = (k: number) => t + k * (secW + t);
      if (inside || state.type === "kupe") {
        // O'rta bokovoylar (kupe eshigi ortidan ham ko'rinadi, shuning uchun doim chiziladi)
        for (let k = 1; k <= nd; k++) B.push(bx(secX(k) - t, secX(k), lh + t, H - t, 0, D, "body"));
      }
      const plan = sectionPlan(nd + 1, p.shelves, p.rods, p.drawers);
      const dh = p.drawers > 0 ? Math.min(180, innerH / (p.drawers + 1)) : 0;
      // Eshik bor bo'lsa tortmalar eshik ortida (ichkarida), ochiq shkafda esa old tomonda
      const behind = state.type === "kupe" || state.params.shkaf.doors > 0;
      const dz = behind ? D - 110 : D;
      plan.forEach((role, k) => {
        const drawersTop = lh + t + (role.drawers > 0 ? role.drawers * (dh + 4) + 3 : 0);
        if (inside) {
          // Javonlar: tortmalar tepasidan shiftgacha bo'lgan oraliqda
          for (const y of shelfYs(drawersTop, H - t, role.shelves, t)) B.push(bx(secX(k), secX(k) + secW, y, y + t, 4, D - 20, "body"));
          // Osma bo'lim: shtanga tepaga yaqin, javonsiz
          if (role.rod) B.push(bx(secX(k) + 8, secX(k) + secW - 8, H - t - 150, H - t - 130, D / 2 - 10, D / 2 + 10, "alu"));
        }
        // Tortmalar o'z bo'limida (kupe eshigi ortida, shkafda old tomonda)
        for (let i = 0; i < role.drawers; i++) {
          const y0 = lh + t + 3 + i * (dh + 4);
          B.push(bx(secX(k) + 3, secX(k) + secW - 3, y0, y0 + dh, dz, dz + t, "door"));
          if (!behind) {
            const cx = secX(k) + secW / 2;
            B.push(bx(cx - 70, cx + 70, y0 + dh / 2 - 7, y0 + dh / 2 + 7, dz + t, dz + t + 18, "handle"));
          }
        }
      });
      const doorBottom = lh + 3;
      if (!inside) {
        if (state.type === "shkaf" && state.params.shkaf.doors > 0) {
          const n = state.params.shkaf.doors;
          const gap = 3;
          const dw = (W - gap * (n + 1)) / n;
          for (let i = 0; i < n; i++) {
            const x0 = gap + i * (dw + gap);
            B.push(bx(x0, x0 + dw, doorBottom, H - gap, D, D + t, "door"));
            const hx = i % 2 === 0 || n === 1 ? x0 + dw - 50 : x0 + 36;
            const hy = (doorBottom + H - gap) / 2;
            B.push(bx(hx, hx + 14, hy - 70, hy + 70, D + t, D + t + 18, "handle"));
          }
        }
      }
      if (state.type === "kupe") {
        const n = Math.max(2, state.params.kupe.sliding);
        const overlap = 30;
        const dw = (W - 2 * t + overlap * (n - 1)) / n;
        const y0 = lh + t + 25;
        const y1 = H - t - 25;
        // Yuqori va pastki rels (g'ildirak yo'li)
        B.push(bx(t, W - t, H - t - 25, H - t, D - 62, D - 12, "alu"));
        B.push(bx(t, W - t, lh + t, lh + t + 12, D - 62, D - 12, "alu"));
        if (!inside) {
          const bar = 22;
          for (let i = 0; i < n; i++) {
            const x0 = t + i * (dw - overlap);
            const z0 = i % 2 === 0 ? D - 26 : D - 52;
            B.push(bx(x0, x0 + dw, y0, y1, z0, z0 + 16, "door"));
            // Ruchka yo'q: alyuminiy ramka profili eshikni ushlash vazifasini ham bajaradi
            B.push(bx(x0, x0 + bar, y0, y1, z0 - 2, z0 + 20, "alu"), bx(x0 + dw - bar, x0 + dw, y0, y1, z0 - 2, z0 + 20, "alu"));
          }
        }
      }
      // Oyoq
      if (lh > 0) {
        const n = legCountFor(W);
        const xs = n >= 6 ? [60, W / 2 - 15, W - 90] : [60, W - 90];
        if (p.legType === "tsokol") {
          B.push(bx(0, W, 0, lh - 3, D - 66, D - 50, "tsokol"));
          for (const x of xs) for (const z of [50, D - 120]) B.push(bx(x, x + 30, 0, lh - 3, z, z + 30, "leg"));
        } else {
          for (const x of xs) for (const z of [50, D - 80]) B.push(bx(x, x + 26, 0, lh, z, z + 26, "leg"));
        }
      }
      return { boxes: B };
    }

    case "oshxona": {
      const k = state.params.oshxona;
      const t = k.thickness;
      const lh = legHeightOf(k);
      const gapMid = 550;
      const baseMods = k.modules.filter((m) => m.kind === "past");
      const wallMods = k.modules.filter((m) => m.kind === "yuqori");
      const baseW = baseMods.reduce((s, m) => s + m.width, 0);
      let x = 0;
      for (const m of baseMods) {
        const y0 = lh;
        const y1 = lh + k.baseHeight;
        B.push(bx(x, x + m.width, y0, y1, 0, k.baseDepth, "body"));
        if (m.doors > 0) {
          const dw = m.width / m.doors;
          for (let i = 0; i < m.doors; i++) {
            const dx = x + i * dw + 2;
            B.push(bx(dx, dx + dw - 4, y0 + 2, y1 - 2, k.baseDepth, k.baseDepth + t, "door"));
            const hx = i % 2 === 0 ? dx + dw - 40 : dx + 22;
            B.push(bx(hx, hx + 12, y1 - 190, y1 - 70, k.baseDepth + t, k.baseDepth + t + 16, "handle"));
          }
        }
        if (m.drawers > 0) {
          const dh = (k.baseHeight - 4) / m.drawers;
          for (let i = 0; i < m.drawers; i++) {
            const dy = y0 + 2 + i * dh;
            B.push(bx(x + 2, x + m.width - 2, dy, dy + dh - 3, k.baseDepth, k.baseDepth + t, "door"));
            B.push(bx(x + m.width / 2 - 60, x + m.width / 2 + 60, dy + dh - 40, dy + dh - 28, k.baseDepth + t, k.baseDepth + t + 16, "handle"));
          }
        }
        if (lh > 0 && k.legType === "nikel") {
          const n = legCountFor(m.width);
          const xs = n >= 6 ? [x + 40, x + m.width / 2 - 13, x + m.width - 66] : [x + 40, x + m.width - 66];
          for (const lx of xs) for (const z of [50, k.baseDepth - 80]) B.push(bx(lx, lx + 26, 0, lh, z, z + 26, "leg"));
        } else if (lh > 0 && k.legType === "tsokol") {
          for (const lx of [x + 40, x + m.width - 70]) for (const z of [50, k.baseDepth - 120]) B.push(bx(lx, lx + 30, 0, lh - 3, z, z + 30, "leg"));
        }
        x += m.width;
      }
      if (baseW > 0) {
        B.push(bx(0, baseW, lh + k.baseHeight, lh + k.baseHeight + 38, 0, k.baseDepth + 30, "counter"));
        if (lh > 0 && k.legType === "tsokol") B.push(bx(0, baseW, 0, lh - 3, k.baseDepth - 66, k.baseDepth - 50, "tsokol"));
      }
      if (baseW > 0 && wallMods.length > 0) {
        const wxEnd = Math.min(baseW, wallMods.reduce((q, m) => q + m.width, 0));
        B.push(bx(0, wxEnd, lh + k.baseHeight + 38, lh + k.baseHeight + 38 + gapMid - 38, 0, 12, "fartuk"));
      }
      let wx = 0;
      const wy0 = lh + k.baseHeight + 38 + gapMid - 38;
      for (const m of wallMods) {
        B.push(bx(wx, wx + m.width, wy0, wy0 + k.wallHeight, 0, k.wallDepth, "body"));
        if (m.doors > 0) {
          const dw = m.width / m.doors;
          for (let i = 0; i < m.doors; i++) {
            const dx = wx + i * dw + 2;
            B.push(bx(dx, dx + dw - 4, wy0 + 2, wy0 + k.wallHeight - 2, k.wallDepth, k.wallDepth + t, "door"));
            const hx = i % 2 === 0 ? dx + dw - 40 : dx + 22;
            B.push(bx(hx, hx + 12, wy0 + 70, wy0 + 190, k.wallDepth + t, k.wallDepth + t + 16, "handle"));
          }
        }
        wx += m.width;
      }
      return { boxes: B };
    }

    case "krovat": {
      const k = state.params.krovat;
      const t = k.thickness;
      const innerW = k.mattressWidth + 20;
      const innerL = k.mattressLength + 20;
      const W = innerW + 2 * t;
      const L = innerL + 2 * t;
      const lh = k.legHeight;
      const top = lh + k.railHeight;
      B.push(bx(0, t, lh, top, 0, L, "body"), bx(W - t, W, lh, top, 0, L, "body"));
      B.push(bx(t, W - t, lh, top, 0, t, "body"), bx(t, W - t, lh, top, L - t, L, "body"));
      if (k.headboard > 0) B.push(bx(0, W, lh, top + k.headboard, -t, 0, "body"));
      B.push(bx(t + 10, W - t - 10, top - 110, top + 110, t + 10, L - t - 10, "mattress"));
      const ls = k.legType === "nikel" ? 30 : 60;
      const mat: Mat = k.legType === "yogoch" ? "wood" : "leg";
      const zs = [0, L - ls];
      for (const x of [0, W - ls]) for (const z of zs) B.push(bx(x, x + ls, 0, lh, z, z + ls, mat));
      if (k.mattressWidth >= 1400) for (const z of [L * 0.3, L * 0.7]) B.push(bx(W / 2 - ls / 2, W / 2 + ls / 2, 0, lh, z, z + ls, mat));
      return { boxes: B };
    }

    case "divan": {
      const d = state.params.divan;
      const L = d.length;
      const D = d.depth;
      const lh = d.legHeight;
      const arm = 170;
      const seat = d.seatHeight;
      const cush = 140;
      B.push(bx(arm, L - arm, lh, seat - cush, 0, D, "body"));
      B.push(bx(0, arm, lh, seat + 180, 0, D, "fabric"), bx(L - arm, L, lh, seat + 180, 0, D, "fabric"));
      B.push(bx(arm, L - arm, seat - cush, seat, 110, D, "fabric"));
      B.push(bx(arm, L - arm, seat - cush, d.backHeight, 0, 110, "fabric"));
      const ls = 50;
      const mat: Mat = d.legType === "yogoch" ? "wood" : "leg";
      const xs = L > 1800 ? [30, L / 2 - ls / 2, L - 30 - ls] : [30, L - 30 - ls];
      for (const x of xs) for (const z of [30, D - 30 - ls]) B.push(bx(x, x + ls, 0, lh, z, z + ls, mat));
      return { boxes: B };
    }
  }
}

// ---------------------------------------------------------------- Kamera va tartib

type V3 = [number, number, number];

function camera(view: View) {
  const yaw = (view.yaw * Math.PI) / 180;
  const pit = (view.pitch * Math.PI) / 180;
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pit);
  const cp = Math.cos(pit);
  const rot = (x: number, y: number, z: number): V3 => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  /** Sahnadan kuzatuvchi tomon yo'nalish */
  const c: V3 = [-sy * cp, sp, cy * cp];
  return { rot, c };
}

type Rect = { x0: number; x1: number; y0: number; y1: number };

function screenRect(b: Box, rot: (x: number, y: number, z: number) => V3, center: V3): Rect {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
    const r = rot(x - center[0], y - center[1], z - center[2]);
    x0 = Math.min(x0, r[0]);
    x1 = Math.max(x1, r[0]);
    y0 = Math.min(y0, -r[1]);
    y1 = Math.max(y1, -r[1]);
  }
  return { x0, x1, y0, y1 };
}

const EPS = 0.01;
const rectsOverlap = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/**
 * Chizish tartibini qaytaradi: orqadagi bo'laklar avval. Ekranda ustma-ust tushadigan har bir juft uchun
 * ajratuvchi tekislikni topadi: kuzatuvchi qaysi tomonda bo'lsa, shu bo'lak oldinda.
 */
export function orderBoxes(boxes: Box[], c: V3, rects: Rect[]): { order: number[]; cycles: number } {
  const n = boxes.length;
  const lo = (b: Box): V3 => [b.x0, b.y0, b.z0];
  const hi = (b: Box): V3 => [b.x1, b.y1, b.z1];
  const out: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!rectsOverlap(rects[i], rects[j])) continue;
      const a = boxes[i];
      const b = boxes[j];
      for (let k = 0; k < 3; k++) {
        if (Math.abs(c[k]) < 1e-9) continue;
        let behind = -1;
        let front = -1;
        if (hi(a)[k] <= lo(b)[k] + EPS) {
          // a pastroqda (k o'qi bo'yicha); c[k] > 0 bo'lsa, b kuzatuvchiga yaqin
          [behind, front] = c[k] > 0 ? [i, j] : [j, i];
        } else if (hi(b)[k] <= lo(a)[k] + EPS) {
          [behind, front] = c[k] > 0 ? [j, i] : [i, j];
        }
        if (behind >= 0) {
          out[behind].push(front);
          indeg[front]++;
          break;
        }
      }
    }
  }
  const mid = boxes.map((b) => ((b.x0 + b.x1) / 2) * c[0] + ((b.y0 + b.y1) / 2) * c[1] + ((b.z0 + b.z1) / 2) * c[2]);
  const done = new Array(n).fill(false);
  const order: number[] = [];
  let cycles = 0;
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) {
      pick = i;
      break;
    }
    if (pick < 0) {
      // Sikl: eng uzoqdagisini tanlaymiz
      cycles++;
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || mid[i] < mid[pick])) pick = i;
    }
    done[pick] = true;
    order.push(pick);
    for (const f of out[pick]) indeg[f]--;
  }
  return { order, cycles };
}

// ---------------------------------------------------------------- Chizish

const MAT: Record<Mat, string> = {
  body: "#e6cda3",
  back: "#d6bb8c",
  door: "#f3eee3",
  leg: "#aab3b7",
  tsokol: "#6c5a3c",
  counter: "#8b949a",
  mattress: "#f6f6f3",
  fabric: "#8fa5a0",
  handle: "#39434a",
  wood: "#b98f52",
  alu: "#c3cacd",
  fartuk: "#d9e0dc",
};

function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const FACES: { n: V3; v: (b: Box) => V3[] }[] = [
  { n: [1, 0, 0], v: (b) => [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]] },
  { n: [-1, 0, 0], v: (b) => [[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]] },
  { n: [0, 1, 0], v: (b) => [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
  { n: [0, -1, 0], v: (b) => [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]] },
  { n: [0, 0, 1], v: (b) => [[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
  { n: [0, 0, -1], v: (b) => [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0]] },
];

const LIGHT: V3 = (() => {
  const l: V3 = [-0.35, 0.8, 0.5];
  const m = Math.hypot(...l);
  return [l[0] / m, l[1] / m, l[2] / m];
})();

export const VIEW_W = 1000;
export const VIEW_H = 860;

export function defaultView(): View {
  return { yaw: -32, pitch: 18 };
}

export function renderScene(scene: Scene, view: View): string {
  const boxes = scene.boxes;
  const { rot, c } = camera(view);
  let mn: V3 = [Infinity, Infinity, Infinity];
  let mx: V3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    mn = [Math.min(mn[0], b.x0), Math.min(mn[1], b.y0), Math.min(mn[2], b.z0)];
    mx = [Math.max(mx[0], b.x1), Math.max(mx[1], b.y1), Math.max(mx[2], b.z1)];
  }
  const center: V3 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  // Ekranga to'liq sig'dirish: proyeksiya chegarasi bo'yicha masshtab va markaz
  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
  for (const b of boxes) {
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const r = rot(x - center[0], y - center[1], z - center[2]);
      sx0 = Math.min(sx0, r[0]); sx1 = Math.max(sx1, r[0]);
      sy0 = Math.min(sy0, -r[1]); sy1 = Math.max(sy1, -r[1]);
    }
  }
  const s = Math.min((VIEW_W * 0.92) / (sx1 - sx0), (VIEW_H * 0.88) / (sy1 - sy0));
  const cx = VIEW_W / 2 - ((sx0 + sx1) / 2) * s;
  const cy = VIEW_H / 2 - ((sy0 + sy1) / 2) * s;
  const P = (x: number, y: number, z: number): [number, number] => {
    const r = rot(x - center[0], y - center[1], z - center[2]);
    return [cx + r[0] * s, cy - r[1] * s];
  };
  const pts = (arr: [number, number][]) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const out: string[] = [];
  out.push(`<svg class="draw3d" viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3D ko'rinish">`);

  // Pol soyasi
  const e = 0.06;
  const w = mx[0] - mn[0];
  const d = mx[2] - mn[2];
  out.push(`<polygon class="shadow3" points="${pts([P(mn[0] - w * e, 0, mn[2] - d * e), P(mx[0] + w * e, 0, mn[2] - d * e), P(mx[0] + w * e, 0, mx[2] + d * e), P(mn[0] - w * e, 0, mx[2] + d * e)])}"/>`);

  const rects = boxes.map((b) => screenRect(b, rot, center));
  const { order } = orderBoxes(boxes, c, rects);
  for (const i of order) {
    const b = boxes[i];
    const hex = MAT[b.mat];
    for (const f of FACES) {
      if (f.n[0] * c[0] + f.n[1] * c[1] + f.n[2] * c[2] <= 1e-6) continue;
      const nv = rot(f.n[0], f.n[1], f.n[2]);
      const lit = Math.max(0, nv[0] * LIGHT[0] + nv[1] * LIGHT[1] + nv[2] * LIGHT[2]);
      const k = 0.74 + 0.3 * lit;
      const poly = f.v(b).map((v) => P(v[0], v[1], v[2]));
      out.push(
        `<polygon class="f3" data-b="${i}" points="${pts(poly)}" fill="${shadeHex(hex, k)}"/>`,
      );
    }
  }
  out.push("</svg>");
  return out.join("");
}

export function render3D(state: AppState, view: View, opts: { inside?: boolean } = {}): string {
  return renderScene(buildScene(state, opts), view);
}
