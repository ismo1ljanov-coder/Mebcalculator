import type { Part, Sheet, Placement, PackedSheet, PackResult } from "./types.ts";

type Rect = { x: number; y: number; w: number; h: number };

type Item = {
  partId: string;
  name: string;
  index: number;
  w: number; // list uzunligi bo'ylab (x)
  h: number; // list eni bo'ylab (y)
  canRotate: boolean;
  /** Oldindan (saralashda) aylantirilganmi: asl detalga nisbatan yo'nalishni to'g'ri ko'rsatish uchun */
  swapped?: boolean;
};

/**
 * Guillotine (to'liq kesim) algoritmi: Best Short Side Fit + Shorter Axis Split.
 * Har bir kesim butun bo'sh to'rtburchak bo'ylab o'tadi, shuning uchun format-kesish
 * stanogida (panel saw) amalda bajarish mumkin.
 *
 * Kerf (arra qalinligi) har bir detal o'lchamiga qo'shiladi, lekin list chetidagi
 * oxirgi kesim uchun tuzatish kiritiladi: detal + kerf sig'maydigan, lekin detalning
 * o'zi sig'adigan joyga ruxsat beriladi.
 */
type Heuristic = {
  /** Bo'sh to'rtburchakni bo'lish usuli */
  split: "short" | "long" | "horizontal" | "vertical";
  /** Joy tanlash mezoni */
  score: "bssf" | "blsf" | "baf";
};

function packOne(items: Item[], sheet: Sheet, heur: Heuristic): { placed: Placement[]; rest: Item[] } {
  const usableW = sheet.length - 2 * sheet.trim;
  const usableH = sheet.width - 2 * sheet.trim;
  const kerf = sheet.kerf;

  let free: Rect[] = [{ x: sheet.trim, y: sheet.trim, w: usableW, h: usableH }];
  const placed: Placement[] = [];
  const rest: Item[] = [];

  for (const item of items) {
    let best: { rectIdx: number; rotated: boolean; score: number; leftover: number } | null = null;

    const orientations: { w: number; h: number; rotated: boolean }[] = [
      { w: item.w, h: item.h, rotated: false },
    ];
    if (item.canRotate && item.w !== item.h) {
      orientations.push({ w: item.h, h: item.w, rotated: true });
    }

    for (let i = 0; i < free.length; i++) {
      const r = free[i];
      for (const o of orientations) {
        if (o.w > r.w || o.h > r.h) continue;
        const leftoverW = r.w - o.w;
        const leftoverH = r.h - o.h;
        const score =
          heur.score === "bssf" ? Math.min(leftoverW, leftoverH) : heur.score === "blsf" ? Math.max(leftoverW, leftoverH) : leftoverW * leftoverH;
        const leftover = leftoverW * leftoverH;
        if (
          best === null ||
          score < best.score ||
          (score === best.score && leftover < best.leftover)
        ) {
          best = { rectIdx: i, rotated: o.rotated, score, leftover };
        }
      }
    }

    if (best === null) {
      rest.push(item);
      continue;
    }

    const r = free[best.rectIdx];
    const w = best.rotated ? item.h : item.w;
    const h = best.rotated ? item.w : item.h;

    placed.push({
      partId: item.partId,
      name: item.name,
      index: item.index,
      x: r.x,
      y: r.y,
      w,
      h,
      // `rotated` — asl detal (length x width) ga nisbatan
      rotated: best.rotated !== !!item.swapped,
    });

    // Bo'sh to'rtburchakni ikkiga bo'lamiz (kerf hisobga olinadi)
    const rightW = Math.max(0, r.w - w - kerf);
    const bottomH = Math.max(0, r.h - h - kerf);
    const next: Rect[] = [];

    // Shorter axis split: qisqa qoldiq tomoni bo'yicha kesamiz
    const splitHorizontally =
      heur.split === "horizontal" ? true : heur.split === "vertical" ? false : heur.split === "short" ? r.w - w < r.h - h : r.w - w >= r.h - h;
    if (splitHorizontally) {
      // O'ng qism faqat detal balandligicha, pastki qism butun kenglikda
      if (rightW > 0 && h > 0) next.push({ x: r.x + w + kerf, y: r.y, w: rightW, h });
      if (bottomH > 0) next.push({ x: r.x, y: r.y + h + kerf, w: r.w, h: bottomH });
    } else {
      // O'ng qism butun balandlikda, pastki qism faqat detal kengligicha
      if (rightW > 0) next.push({ x: r.x + w + kerf, y: r.y, w: rightW, h: r.h });
      if (bottomH > 0 && w > 0) next.push({ x: r.x, y: r.y + h + kerf, w, h: bottomH });
    }

    free = [...free.slice(0, best.rectIdx), ...free.slice(best.rectIdx + 1), ...next];
  }

  return { placed, rest };
}

export function expandParts(parts: Part[]): Item[] {
  const items: Item[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.qty; i++) {
      items.push({
        partId: p.id,
        name: p.name,
        index: i + 1,
        w: p.length,
        h: p.width,
        // Tekstura yo'nalishi bo'lsa, aylantirib bo'lmaydi
        canRotate: !p.grain,
      });
    }
  }
  return items;
}

const SORTS: ((a: Item, b: Item) => number)[] = [
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => b.h - a.h || b.w - a.w,
];

const HEURISTICS: Heuristic[] = (["short", "long", "horizontal", "vertical"] as const).flatMap((split) =>
  (["bssf", "blsf", "baf"] as const).map((score) => ({ split, score })),
);

function runAll(items: Item[], sheet: Sheet): { sheets: PackedSheet[]; leftover: Item[] } {
  const sheetArea = sheet.length * sheet.width;
  const sheets: PackedSheet[] = [];
  let remaining = items;
  while (remaining.length > 0) {
    const { placed, rest } = packOne(remaining, sheet, CURRENT);
    if (placed.length === 0) return { sheets, leftover: rest };
    sheets.push({ placements: placed, usedArea: placed.reduce((s, p) => s + p.w * p.h, 0), sheetArea });
    remaining = rest;
  }
  return { sheets, leftover: [] };
}

// runAll ichida ishlatiladigan joriy heuristika (oddiy, sinxron: parallel chaqiruv yo'q)
let CURRENT: Heuristic = HEURISTICS[0];

/**
 * Detallarni listlarga joylashtiradi. Bir xil qalinlikdagi detallar uchun chaqiriladi.
 * Bir nechta saralash va bo'lish usullarini sinab, eng kam list ishlatadiganini tanlaydi
 * (teng bo'lsa, oxirgi list eng bo'sh bo'lgani — katta qoldiq bo'lagi qoladi).
 */
export function packParts(parts: Part[], sheet: Sheet): PackResult {
  const sheetArea = sheet.length * sheet.width;
  const unplaced: PackResult["unplaced"] = [];

  // Sig'maydigan detallar cheksiz tsiklga olib kelmasin
  const fits = (it: Item) => {
    const uw = sheet.length - 2 * sheet.trim;
    const uh = sheet.width - 2 * sheet.trim;
    return (it.w <= uw && it.h <= uh) || (it.canRotate && it.h <= uw && it.w <= uh);
  };
  const feasible: Item[] = [];
  for (const it of expandParts(parts)) {
    if (fits(it)) feasible.push(it);
    else unplaced.push({ partId: it.partId, name: it.name, index: it.index });
  }

  // Aylantirsa bo'ladigan detalni list bo'ylab yo'naltiramiz
  const oriented = feasible.map((it) =>
    it.canRotate && it.h > it.w ? { ...it, w: it.h, h: it.w, swapped: true } : it,
  );

  let best: PackedSheet[] | null = null;
  for (const sort of SORTS) {
    const sorted = [...oriented].sort(sort);
    for (const heur of HEURISTICS) {
      CURRENT = heur;
      const r = runAll(sorted, sheet);
      if (r.leftover.length > 0) continue;
      const better =
        best === null ||
        r.sheets.length < best.length ||
        (r.sheets.length === best.length &&
          (r.sheets[r.sheets.length - 1]?.usedArea ?? 0) < (best[best.length - 1]?.usedArea ?? 0));
      if (better) best = r.sheets;
    }
  }
  const sheets = best ?? [];
  if (best === null && oriented.length > 0) {
    for (const it of oriented) unplaced.push({ partId: it.partId, name: it.name, index: it.index });
  }

  const totalUsedArea = sheets.reduce((s, x) => s + x.usedArea, 0);
  const totalSheetArea = sheets.length * sheetArea;
  const utilization = totalSheetArea === 0 ? 0 : (totalUsedArea / totalSheetArea) * 100;

  return {
    sheets,
    unplaced,
    totalUsedArea,
    totalSheetArea,
    utilization,
    waste: totalSheetArea === 0 ? 0 : 100 - utilization,
  };
}
