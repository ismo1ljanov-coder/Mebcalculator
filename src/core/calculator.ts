import { packParts } from "./binPacking.ts";
import { edgeLengthMeters } from "./edge.ts";
import type { BuildResult } from "./templates.ts";
import type { PackResult, Part, Sheet } from "./types.ts";

export type Prices = {
  /** 1 dona LDSP list narxi, so'm (qalinlik bo'yicha: kalit = mm) */
  sheetByThickness: Record<number, number>;
  /** 1 pog.m kant, so'm */
  edgePerMeter: number;
  /** 1 dona DVP list (2750x1700) narxi, so'm */
  backPanelSheet: number;
  /** Usta ish haqi: material narxining foizi yoki belgilangan summa */
  labor: { mode: "percent"; value: number } | { mode: "fixed"; value: number };
  /** Foyda foizi (umumiy tannarx ustiga) */
  marginPercent: number;
};

export type MaterialGroup = {
  thickness: number;
  partsCount: number;
  pack: PackResult;
};

export type CalcResult = {
  groups: MaterialGroup[];
  edge: { net: number; withWaste: number };
  backPanel: { m2: number; sheets: number };
  furniture: BuildResult["furniture"];
  notes: string[];
  cost: {
    ldsp: number;
    edge: number;
    backPanel: number;
    labor: number;
    subtotal: number;
    margin: number;
    total: number;
  };
  /** Qaysi detallar sig'maganligi haqida ogohlantirishlar */
  warnings: string[];
};

const DVP_SHEET_AREA = (2750 * 1700) / 1e6; // m²

export function calculate(
  build: BuildResult,
  sheet: Omit<Sheet, "thickness">,
  prices: Prices,
  opts: { edgeWaste?: number; dvpWaste?: number } = {},
): CalcResult {
  const edgeWaste = opts.edgeWaste ?? 0.07;
  const dvpWaste = opts.dvpWaste ?? 0.15;

  // Qalinlik bo'yicha guruhlaymiz: har biri alohida list turi
  const byT = new Map<number, Part[]>();
  for (const p of build.parts) {
    const arr = byT.get(p.thickness) ?? [];
    arr.push(p);
    byT.set(p.thickness, arr);
  }

  const groups: MaterialGroup[] = [];
  const warnings: string[] = [];
  for (const [thickness, parts] of [...byT.entries()].sort((a, b) => a[0] - b[0])) {
    const pack = packParts(parts, { ...sheet, thickness });
    groups.push({ thickness, partsCount: parts.reduce((s, p) => s + p.qty, 0), pack });
    for (const u of pack.unplaced) {
      warnings.push(`"${u.name}" (#${u.index}) ${thickness} mm listga sig'maydi — o'lchamni tekshiring.`);
    }
  }

  const edge = edgeLengthMeters(build.parts, edgeWaste);
  const dvpSheets = build.backPanelM2 > 0 ? Math.ceil((build.backPanelM2 * (1 + dvpWaste)) / DVP_SHEET_AREA) : 0;

  const ldspCost = groups.reduce((s, g) => {
    const price = prices.sheetByThickness[g.thickness] ?? 0;
    if (price === 0 && g.pack.sheets.length > 0) {
      warnings.push(`${g.thickness} mm LDSP narxi kiritilmagan.`);
    }
    return s + g.pack.sheets.length * price;
  }, 0);
  const edgeCost = Math.ceil(edge.withWaste) * prices.edgePerMeter;
  const dvpCost = dvpSheets * prices.backPanelSheet;
  const materials = ldspCost + edgeCost + dvpCost;
  const labor = prices.labor.mode === "percent" ? (materials * prices.labor.value) / 100 : prices.labor.value;
  const subtotal = materials + labor;
  const margin = (subtotal * prices.marginPercent) / 100;

  return {
    groups,
    edge,
    backPanel: { m2: build.backPanelM2, sheets: dvpSheets },
    furniture: build.furniture,
    notes: build.notes,
    cost: {
      ldsp: ldspCost,
      edge: edgeCost,
      backPanel: dvpCost,
      labor,
      subtotal,
      margin,
      total: subtotal + margin,
    },
    warnings,
  };
}
