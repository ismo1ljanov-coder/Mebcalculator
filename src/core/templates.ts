import type { Part } from "./types.ts";

// Barcha o'lchamlar millimetrda.

export type FurnitureType = "shkaf" | "kupe" | "oshxona" | "krovat" | "divan";

/** Shkaf/kupe/oshxona uchun oyoq turi: yo'q (polga tegadi), tsokol (LDSP planka + plastik oyoq), nikel (ochiq metall oyoq) */
export type LegType = "yoq" | "tsokol" | "nikel";
/** Krovat/divan oyog'i materiali */
export type BedLegType = "yogoch" | "nikel" | "plastik";

export type FurnitureItem = { name: string; qty: number; unit: string; note?: string };

export type BuildResult = {
  /** LDSP detallari (qalinligi part.thickness bilan) */
  parts: Part[];
  /** Orqa devor DVP/HDF, m² */
  backPanelM2: number;
  /** Furnitura va boshqa sotib olinadigan buyumlar */
  furniture: FurnitureItem[];
  /** Ustaga ko'rsatiladigan eslatmalar */
  notes: string[];
};

const noEdge = { L1: false, L2: false, W1: false, W2: false };
const frontEdge = { L1: true, L2: false, W1: false, W2: false };
const allEdge = { L1: true, L2: true, W1: true, W2: true };

let counter = 0;
function mk(
  name: string,
  length: number,
  width: number,
  qty: number,
  t: number,
  opts: Partial<Pick<Part, "grain" | "edge">> = {},
): Part {
  counter += 1;
  return {
    id: `p${counter}`,
    name,
    length: Math.round(length),
    width: Math.round(width),
    qty,
    thickness: t,
    grain: opts.grain ?? false,
    edge: opts.edge ?? noEdge,
  };
}

/** Eshik balandligiga qarab sharnir soni (amaliy qoida) */
export function hingesPerDoor(doorHeight: number): number {
  if (doorHeight <= 1000) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/** Karkas ostidagi oyoq balandligi (mm). "yoq" bo'lsa 0. */
export function legHeightOf(p: { legType: LegType; plinth: number }): number {
  return p.legType === "yoq" ? 0 : Math.max(0, p.plinth);
}

/** Karkas uchun oyoq soni: keng bo'lsa o'rtaga qo'shimcha tayanch */
export function legCountFor(width: number): number {
  return width > 1000 ? 6 : 4;
}

/**
 * Oyoq qismini qo'shadi.
 * - tsokol: old planka (LDSP) + rostlanadigan plastik oyoqlar
 * - nikel: ochiq metall oyoqlar (planka yo'q)
 */
function addLegs(
  p: { legType: LegType; plinth: number; width: number; thickness: number },
  parts: Part[],
  furniture: FurnitureItem[],
  notes: string[],
) {
  const h = legHeightOf(p);
  if (h === 0) return;
  const n = legCountFor(p.width);
  if (p.legType === "tsokol") {
    // Polgacha 3 mm zazor qoldiriladi
    parts.push(mk("Tsokol planka (old)", p.width, h - 3, 1, p.thickness, { grain: true, edge: { ...noEdge, L1: true } }));
    furniture.push({ name: "Rostlanadigan oyoq (plastik)", qty: n, unit: "dona", note: `${h} mm` });
    furniture.push({ name: "Tsokol mahkamlagich (klips)", qty: 2, unit: "dona" });
  } else {
    furniture.push({ name: "Nikel (xrom) oyoq", qty: n, unit: "dona", note: `${h} mm balandlik` });
    furniture.push({ name: "Oyoq mahkamlash plastinkasi", qty: n, unit: "dona" });
    notes.push("Nikel oyoq ochiq turadi: karkas tagi ko'rinadi, shuning uchun past (pol) paneli ham kant bilan yopilgani yaxshi.");
  }
}

// ---------------------------------------------------------------- SHKAF

export type ShkafParams = {
  width: number;
  height: number;
  depth: number;
  thickness: number;
  /** Ichki javonlar soni */
  shelves: number;
  /** Eshiklar soni (0 = ochiq) */
  doors: number;
  /** Tortmalar soni */
  drawers: number;
  /** Kiyim osish shtangalari soni */
  rods: number;
  legType: LegType;
  /** Oyoq/tsokol balandligi, mm (umumiy balandlikka kiradi) */
  plinth: number;
};

export const SHKAF_DEFAULT: ShkafParams = {
  width: 1200,
  height: 2200,
  depth: 550,
  thickness: 16,
  shelves: 4,
  doors: 2,
  drawers: 0,
  rods: 0,
  legType: "yoq",
  plinth: 0,
};

/**
 * O'rta bokovoy (vertikal devor) soni. LDSP javon ~800 mm dan uzun oraliqda egiladi,
 * javonsiz tepa/past esa ~1200 mm gacha chidaydi.
 */
export function dividerCount(inner: number, hasShelves: boolean): number {
  const span = hasShelves ? 800 : 1200;
  return Math.max(0, Math.ceil(inner / span) - 1);
}

export type SectionRole = { rod: boolean; shelves: number; drawers: number };

/**
 * Bo'limlar vazifasi (haqiqiy shkafdagidek): birinchi `rods` ta bo'lim OSMA (shtanga, javonsiz),
 * qolganlarida JAVONLAR; tortmalar javonli bo'limning pastida (hammasi osma bo'lsa, oxirgisida).
 * `shelves` = har bir javonli bo'limdagi javonlar soni.
 */
export function sectionPlan(sections: number, shelves: number, rods: number, drawers: number): SectionRole[] {
  const r = Math.min(Math.max(0, rods), sections);
  const plan: SectionRole[] = Array.from({ length: sections }, (_, k) => ({ rod: k < r, shelves: k < r ? 0 : shelves, drawers: 0 }));
  if (drawers > 0) plan[r < sections ? r : sections - 1].drawers = drawers;
  return plan;
}

/** n ta javonning pastki qirrasi balandligi (bo'sh joy [bottom, top] ichida teng taqsimlangan) */
export function shelfYs(bottom: number, top: number, n: number, t: number): number[] {
  return Array.from({ length: n }, (_, i) => bottom + ((top - bottom) * (i + 1)) / (n + 1) - t / 2);
}

/** Karkas: ikki yon, tepa, past, o'rta bokovoy, javonlar */
function carcass(p: ShkafParams, label = "") {
  const t = p.thickness;
  const inner = p.width - 2 * t;
  const bodyH = p.height - legHeightOf(p);
  const d = dividerCount(inner, p.shelves > 0);
  const secW = (inner - d * t) / (d + 1);
  // List uzunligidan (2750) uzun panel bitta bo'lakka sig'maydi: teng bo'laklarga bo'linadi
  const pieces = Math.max(1, Math.ceil(inner / MAX_PANEL));
  const pieceLen = Math.ceil(inner / pieces);
  const parts: Part[] = [
    mk(`${label}Yon devor`, bodyH, p.depth, 2, t, { grain: true, edge: frontEdge }),
    mk(`${label}Tepa${pieces > 1 ? " (bo'lak)" : ""}`, pieceLen, p.depth, pieces, t, { edge: frontEdge }),
    mk(`${label}Past${pieces > 1 ? " (bo'lak)" : ""}`, pieceLen, p.depth, pieces, t, { edge: frontEdge }),
  ];
  if (d > 0) parts.push(mk(`${label}O'rta bokovoy`, bodyH - 2 * t, p.depth, d, t, { grain: true, edge: frontEdge }));
  const plan = sectionPlan(d + 1, p.shelves, p.rods, p.drawers);
  const totalShelves = plan.reduce((x, r) => x + r.shelves, 0);
  if (totalShelves > 0) {
    parts.push(mk(`${label}Javon`, Math.floor(secW) - 2, p.depth - 20, totalShelves, t, { edge: frontEdge }));
  }
  return { parts, d, secW, pieces, plan, totalShelves };
}

/** Bitta LDSP panelining eng katta uzunligi (list 2750 mm dan trim va kesim ayirilgan) */
const MAX_PANEL = 2700;

export function buildShkaf(p: ShkafParams): BuildResult {
  const t = p.thickness;
  const { parts, d, secW, pieces, plan, totalShelves } = carcass(p);
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];
  const bodyH = p.height - legHeightOf(p);

  // Orqa devor DVP
  const backPanelM2 = ((p.width - 4) * (bodyH - 4)) / 1e6;

  if (p.doors > 0) {
    const gap = 3;
    const doorW = Math.floor((p.width - gap * (p.doors + 1)) / p.doors);
    const doorH = bodyH - 2 * gap;
    parts.push(mk("Eshik", doorH, doorW, p.doors, t, { grain: true, edge: allEdge }));
    const hp = hingesPerDoor(doorH);
    furniture.push({ name: "Sharnir (aylanma, 35 mm)", qty: hp * p.doors, unit: "dona" });
    furniture.push({ name: "Sharnir plankasi", qty: hp * p.doors, unit: "dona" });
    furniture.push({ name: "Ruchka", qty: p.doors, unit: "dona" });
  }

  if (p.drawers > 0) {
    const dW = Math.floor(secW) - 2 * 13;
    const dDepth = p.depth - 50;
    const front = 180;
    parts.push(
      mk("Tortma old (fasad)", dW + 2 * 13 - 4, front, p.drawers, t, { grain: true, edge: allEdge }),
      mk("Tortma yon", dDepth, front - 30, p.drawers * 2, t, { edge: { ...noEdge, L1: true } }),
      mk("Tortma orqa", dW - 2 * t, front - 30, p.drawers, t, { edge: { ...noEdge, L1: true } }),
    );
    furniture.push({ name: "Tortma yo'naltiruvchi (juft)", qty: p.drawers, unit: "juft" });
    furniture.push({ name: "Tortma taglik DVP", qty: p.drawers, unit: "dona", note: `${dW} x ${dDepth} mm` });
    furniture.push({ name: "Ruchka (tortma)", qty: p.drawers, unit: "dona" });
    if (d > 0) notes.push("Tortmalar birinchi (chap) bo'limga qo'yiladi.");
  }

  if (totalShelves > 0) {
    furniture.push({ name: "Javon tayanchi (polka tayanchi)", qty: totalShelves * 4, unit: "dona" });
  }
  addRods(plan.filter((r) => r.rod).length, secW, furniture);
  const joints = 8 + d * 4 + totalShelves * 4;
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: joints, unit: "dona" });
  furniture.push({ name: "DVP mix (mix 3x16)", qty: Math.ceil(((p.width + bodyH) * 2) / 150), unit: "dona", note: "orqa devor uchun, ~150 mm qadam" });

  addLegs(p, parts, furniture, notes);

  addDividerNote(d, secW, p.shelves > 0, notes);
  addPlanNote(plan, notes);
  addSplitNote(pieces, notes);
  addWallBrackets(p.height, furniture, notes);

  return { parts, backPanelM2, furniture, notes };
}

function addPlanNote(plan: SectionRole[], notes: string[]) {
  const hang = plan.filter((r) => r.rod).length;
  const shelf = plan.length - hang;
  const dr = plan.findIndex((r) => r.drawers > 0);
  const parts = [`${plan.length} ta bo'lim: ${hang} ta osma (shtanga), ${shelf} ta javonli`];
  if (dr >= 0) parts.push(`tortmalar ${dr + 1}-bo'limda, pastda`);
  notes.push(parts.join(", ") + ".");
}

function addRods(n: number, secW: number, furniture: FurnitureItem[]) {
  if (n <= 0) return;
  furniture.push({ name: "Shtanga (kiyim osish, oval)", qty: n, unit: "dona", note: `~${Math.floor(secW) - 4} mm (bo'lim eni)` });
  furniture.push({ name: "Shtanga ushlagich", qty: n * 2, unit: "dona" });
}

function addDividerNote(d: number, secW: number, shelves: boolean, notes: string[]) {
  if (d > 0) {
    notes.push(`Eni katta: ${d} ta o'rta bokovoy qo'yildi, ${d + 1} ta bo'lim (har biri ~${Math.round(secW)} mm). ${shelves ? "Javonlar bo'limlarga bo'lingani uchun egilmaydi." : ""}`.trim());
  }
}

function addSplitNote(pieces: number, notes: string[]) {
  if (pieces > 1) notes.push(`Tepa va past paneli listga sig'maydi: ${pieces} bo'lakka bo'lindi. Tutashgan joyi o'rta bokovoy ustiga tushsin.`);
}

function addWallBrackets(height: number, furniture: FurnitureItem[], notes: string[]) {
  if (height > 2000) {
    furniture.push({ name: "Mebel burchagi (devorga mahkamlash)", qty: 2, unit: "dona" });
    notes.push("Balandlik 2000 mm dan oshdi: yiqilib ketmasligi uchun devorga burchaklik bilan mahkamlang.");
  }
}

// ---------------------------------------------------------------- KUPE

/** antresol: kupe tepasidagi alohida ochiladigan shkafcha balandligi, mm (0 = yo'q) */
export type KupeParams = ShkafParams & { sliding: number; antresol: number };

export const KUPE_DEFAULT: KupeParams = {
  ...SHKAF_DEFAULT,
  width: 1800,
  height: 2400,
  depth: 600,
  doors: 0,
  rods: 1,
  sliding: 2,
  antresol: 0,
};

export function buildKupe(p: KupeParams): BuildResult {
  const t = p.thickness;
  const A = Math.max(0, p.antresol);
  const { parts, d, secW, pieces, plan, totalShelves } = carcass({ ...p, doors: 0, height: p.height - A });
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];
  const bodyH = p.height - A - legHeightOf(p);
  let backPanelM2 = ((p.width - 4) * (bodyH - 4)) / 1e6;

  const n = Math.max(2, p.sliding);
  const overlap = 30;
  const rail = 45;
  const doorW = (p.width - 2 * t + overlap * (n - 1)) / n;
  const doorH = bodyH - 2 * t - rail - 5;
  parts.push(mk("Kupe eshik (ramka ichiga)", doorH, doorW, n, t, { grain: true, edge: allEdge }));

  furniture.push({ name: "Kupe tizimi (ustki + pastki rels)", qty: 1, unit: "komplekt", note: `eni ${p.width - 2 * t} mm, ${n} ta eshik` });
  furniture.push({ name: "Rolik (g'ildirak) komplekti", qty: n, unit: "komplekt" });
  // Kupe eshigida oddiy ruchka yo'q: alyuminiy ramka profili ham ushlagich vazifasini bajaradi
  furniture.push({ name: "Eshik ramka profili (vertikal)", qty: n * 2, unit: "dona", note: `${Math.round(doorH)} mm` });
  furniture.push({ name: "Eshik ramka profili (gorizontal)", qty: n * 2, unit: "dona", note: `${Math.round(doorW)} mm` });
  furniture.push({ name: "Yumshoq yopgich (dovodchik)", qty: n, unit: "dona", note: "ixtiyoriy, jimgina yopilishi uchun" });
  furniture.push({ name: "To'xtatgich (stopper)", qty: 2, unit: "dona" });
  if (totalShelves > 0) furniture.push({ name: "Javon tayanchi", qty: totalShelves * 4, unit: "dona" });
  addRods(plan.filter((r) => r.rod).length, secW, furniture);
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: 8 + d * 4 + totalShelves * 4, unit: "dona" });
  furniture.push({ name: "DVP mix (3x16)", qty: Math.ceil(((p.width + bodyH) * 2) / 150), unit: "dona" });

  addLegs(p, parts, furniture, notes);

  if (A > 0) {
    // Antresol: kupe ustidagi alohida shkafcha, oldi ochiladigan (sharnirli) eshiklar
    const inner = p.width - 2 * t;
    const aPieces = Math.max(1, Math.ceil(inner / MAX_PANEL));
    parts.push(mk("Antresol yon", A, p.depth, 2, t, { grain: true, edge: frontEdge }));
    parts.push(mk("Antresol tepa", Math.ceil(inner / aPieces), p.depth, aPieces, t, { edge: frontEdge }));
    const aSections = Math.max(1, Math.ceil(inner / 800));
    if (aSections > 1) parts.push(mk("Antresol o'rta bokovoy", A - 2 * t, p.depth, aSections - 1, t, { grain: true, edge: frontEdge }));
    const dn = Math.max(2, Math.ceil(p.width / 450));
    const gap = 3;
    const aDoorW = Math.floor((p.width - gap * (dn + 1)) / dn);
    const aDoorH = A - 2 * gap;
    parts.push(mk("Antresol eshik", aDoorH, aDoorW, dn, t, { grain: true, edge: allEdge }));
    const hp = hingesPerDoor(aDoorH);
    furniture.push({ name: "Sharnir (antresol eshigi)", qty: hp * dn, unit: "dona" });
    furniture.push({ name: "Sharnir plankasi (antresol)", qty: hp * dn, unit: "dona" });
    furniture.push({ name: "Ruchka (antresol)", qty: dn, unit: "dona", note: "yoki bosib ochiladigan (push) mexanizm" });
    furniture.push({ name: "Konfirmat (antresol)", qty: 8 + (aSections - 1) * 4, unit: "dona" });
    backPanelM2 += ((p.width - 4) * (A - 4)) / 1e6;
    notes.push(`Antresol: ${A} mm balandlik, ${dn} ta eshik. Kupe tepasiga qo'yiladi, ikki yon devor kupe yoniga tegib turishi uchun o'lchamni tekshiring.`);
  }
  addDividerNote(d, secW, p.shelves > 0, notes);
  addPlanNote(plan, notes);
  addSplitNote(pieces, notes);
  addWallBrackets(p.height, furniture, notes);
  notes.push("Kupe eshiklari g'ildirakda yonga suriladi (ruchka yo'q). Eshik o'lchami tizim ishlab chiqaruvchisining jadvaliga qarab tekshirilsin: har brend ruxsat etgan balandlik va og'irligi farq qiladi.");
  if (doorW > 1000) notes.push("Eshik eni 1000 mm dan katta: og'ir bo'ladi, 3 ta eshikka o'tish yaxshiroq.");

  return { parts, backPanelM2, furniture, notes };
}

// ---------------------------------------------------------------- OSHXONA

export type KitchenModule = {
  kind: "past" | "yuqori";
  width: number;
  doors: number;
  drawers: number;
  shelves: number;
};

export type OshxonaParams = {
  thickness: number;
  /** Pastki tumba balandligi (oyoqsiz), mm */
  baseHeight: number;
  baseDepth: number;
  wallHeight: number;
  wallDepth: number;
  legType: LegType;
  plinth: number;
  modules: KitchenModule[];
};

export const OSHXONA_DEFAULT: OshxonaParams = {
  thickness: 16,
  baseHeight: 720,
  baseDepth: 560,
  wallHeight: 720,
  wallDepth: 320,
  legType: "tsokol",
  plinth: 100,
  modules: [
    { kind: "past", width: 600, doors: 1, drawers: 0, shelves: 1 },
    { kind: "past", width: 800, doors: 0, drawers: 3, shelves: 0 },
    { kind: "past", width: 600, doors: 2, drawers: 0, shelves: 1 },
    { kind: "yuqori", width: 600, doors: 1, drawers: 0, shelves: 2 },
    { kind: "yuqori", width: 800, doors: 2, drawers: 0, shelves: 2 },
  ],
};

export function buildOshxona(p: OshxonaParams): BuildResult {
  const t = p.thickness;
  const parts: Part[] = [];
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];
  let backM2 = 0;
  let hinges = 0;
  let handles = 0;
  let joints = 0;
  let counterMm = 0;
  let slides = 0;
  let legs = 0;

  p.modules.forEach((m, i) => {
    const base = m.kind === "past";
    const H = base ? p.baseHeight : p.wallHeight;
    const D = base ? p.baseDepth : p.wallDepth;
    const label = `${base ? "Past" : "Yuqori"} #${i + 1}: `;
    const inner = m.width - 2 * t;

    parts.push(mk(`${label}Yon devor`, H, D, 2, t, { grain: true, edge: frontEdge }));
    parts.push(mk(`${label}Past`, inner, D, 1, t, { edge: frontEdge }));
    const dv = dividerCount(inner, m.shelves > 0);
    if (dv > 0) parts.push(mk(`${label}O'rta bokovoy`, H - 2 * t, D, dv, t, { grain: true, edge: frontEdge }));
    const secW = (inner - dv * t) / (dv + 1);
    if (base) {
      parts.push(mk(`${label}Ustki planka (old/orqa)`, inner, 100, 2, t, { edge: noEdge }));
      counterMm += m.width;
      legs += m.width > 1000 ? 6 : 4;
    } else {
      parts.push(mk(`${label}Tepa`, inner, D, 1, t, { edge: frontEdge }));
      parts.push(mk(`${label}Osma planka (devorga)`, inner, 100, 1, t, { edge: noEdge }));
    }
    if (m.shelves > 0) {
      parts.push(mk(`${label}Javon`, Math.floor(secW) - 2, D - 20, m.shelves * (dv + 1), t, { edge: frontEdge }));
      furniture.push({ name: `Javon tayanchi (${label.trim()})`, qty: m.shelves * (dv + 1) * 4, unit: "dona" });
    }
    if (m.doors > 0) {
      const doorW = Math.floor((m.width - 3 * (m.doors + 1)) / m.doors);
      const doorH = H - 6;
      parts.push(mk(`${label}Eshik`, doorH, doorW, m.doors, t, { grain: true, edge: allEdge }));
      hinges += hingesPerDoor(doorH) * m.doors;
      handles += m.doors;
    }
    if (m.drawers > 0) {
      const each = (H - 3 * (m.drawers + 1)) / m.drawers;
      parts.push(mk(`${label}Tortma fasad`, m.width - 6, each, m.drawers, t, { grain: true, edge: allEdge }));
      parts.push(mk(`${label}Tortma yon`, D - 70, each - 40, m.drawers * 2, t, { edge: { ...noEdge, L1: true } }));
      parts.push(mk(`${label}Tortma orqa`, inner - 2 * 13 - 2 * t, each - 40, m.drawers, t, { edge: { ...noEdge, L1: true } }));
      slides += m.drawers;
      handles += m.drawers;
    }
    backM2 += ((m.width - 4) * (H - 4)) / 1e6;
    joints += 8 + dv * 4 + m.shelves * (dv + 1) * 4;
  });

  if (hinges > 0) {
    furniture.push({ name: "Sharnir (aylanma, 35 mm)", qty: hinges, unit: "dona" });
    furniture.push({ name: "Sharnir plankasi", qty: hinges, unit: "dona" });
  }
  if (slides > 0) {
    furniture.push({ name: "Tortma yo'naltiruvchi (juft)", qty: slides, unit: "juft" });
    furniture.push({ name: "Tortma taglik DVP", qty: slides, unit: "dona" });
  }
  if (handles > 0) furniture.push({ name: "Ruchka", qty: handles, unit: "dona" });
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: joints, unit: "dona" });

  const nBase = p.modules.filter((m) => m.kind === "past").length;
  const lh = legHeightOf(p);
  if (nBase > 0) {
    furniture.push({ name: "Stoleshnitsa", qty: Math.round(counterMm) / 1000, unit: "m (uzunlik)", note: "eni ~600 mm, LDSP emas, alohida material" });
    if (p.legType === "tsokol" && lh > 0) {
      furniture.push({ name: "Rostlanadigan oyoq (plastik)", qty: legs, unit: "dona", note: `${lh} mm` });
      furniture.push({ name: "Tsokol planka (PVC/alyuminiy)", qty: Math.round(counterMm) / 1000, unit: "m", note: `${lh} mm balandlik` });
    } else if (p.legType === "nikel" && lh > 0) {
      furniture.push({ name: "Nikel (xrom) oyoq", qty: legs, unit: "dona", note: `${lh} mm balandlik` });
      furniture.push({ name: "Oyoq mahkamlash plastinkasi", qty: legs, unit: "dona" });
      notes.push("Nikel oyoqli oshxonada tsokol planka yo'q: pol bilan tumba orasi ochiq qoladi.");
    }
  }
  const nWall = p.modules.filter((m) => m.kind === "yuqori").length;
  if (nWall > 0) furniture.push({ name: "Osma shkaf mahkamlagichi", qty: nWall * 2, unit: "dona" });
  const links = Math.max(0, nBase - 1) + Math.max(0, nWall - 1);
  if (links > 0) furniture.push({ name: "Tumbalarni biriktiruvchi bolt/vint", qty: links * 2, unit: "dona", note: "qo'shni modullarni tortib turadi" });

  notes.push("Stoleshnitsa, fartuk (devor oralig'i) va texnika uchun kesimlar alohida o'lchanadi.");
  notes.push("Plita/moyka uchun tumba kesimi va gaz/suv quvurlari bu hisobga kirmagan.");

  return { parts, backPanelM2: backM2, furniture, notes };
}

// ---------------------------------------------------------------- KROVAT

export type KrovatParams = {
  thickness: number;
  mattressWidth: number;
  mattressLength: number;
  /** Ramka balandligi (yon taxta) */
  railHeight: number;
  /** Bosh taxta balandligi, 0 = yo'q */
  headboard: number;
  /** Ostida tortma (sandiq) */
  drawers: number;
  legType: BedLegType;
  legHeight: number;
};

export const KROVAT_DEFAULT: KrovatParams = {
  thickness: 18,
  mattressWidth: 1600,
  mattressLength: 2000,
  railHeight: 250,
  headboard: 600,
  drawers: 0,
  legType: "yogoch",
  legHeight: 150,
};

const BED_LEG_NAME: Record<BedLegType, string> = {
  yogoch: "Yog'och oyoq",
  nikel: "Nikel (xrom) oyoq",
  plastik: "Plastik oyoq",
};

export function buildKrovat(p: KrovatParams): BuildResult {
  const t = p.thickness;
  const clearance = 20;
  const innerW = p.mattressWidth + clearance;
  const innerL = p.mattressLength + clearance;
  const parts: Part[] = [];
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];

  parts.push(mk("Yon taxta", innerL + 2 * t, p.railHeight, 2, t, { grain: true, edge: { ...noEdge, L1: true, L2: false, W1: true, W2: true } }));
  parts.push(mk("Bosh/oyoq taxta", innerW, p.railHeight, 2, t, { edge: { ...noEdge, L1: true } }));
  if (p.headboard > 0) {
    parts.push(mk("Bosh taxta (izgolove)", innerW + 2 * t, p.headboard, 1, t, { edge: allEdge }));
  }
  const center = p.mattressWidth >= 1400;
  if (center) parts.push(mk("O'rta tayanch (balka)", innerL, 100, 1, t, { edge: noEdge }));
  parts.push(mk("Lamel tayanch reyka", innerL, 50, 2, t, { edge: noEdge }));

  const slatPitch = 90;
  const slats = Math.ceil(innerL / slatPitch);
  furniture.push({ name: "Lamel (reyka)", qty: slats, unit: "dona", note: `${innerW} mm, taxminan ${slatPitch} mm qadam` });
  const legs = center ? 6 : 4;
  furniture.push({ name: BED_LEG_NAME[p.legType], qty: legs, unit: "dona", note: `${p.legHeight} mm${center ? ", o'rtada 2 tasi tayanch uchun" : ""}` });
  furniture.push({ name: "Burchak mahkamlagich (krovat bolti)", qty: 8, unit: "dona" });
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: 12, unit: "dona" });

  if (p.drawers > 0) {
    const dDepth = Math.min(innerL - 200, 900);
    parts.push(
      mk("Sandiq tortma fasad", innerW / Math.max(1, p.drawers) - 4, p.railHeight - 20, p.drawers, t, { edge: allEdge }),
      mk("Sandiq tortma yon", dDepth, p.railHeight - 60, p.drawers * 2, t, { edge: { ...noEdge, L1: true } }),
      mk("Sandiq tortma orqa", innerW / Math.max(1, p.drawers) - 4 - 2 * t, p.railHeight - 60, p.drawers, t, { edge: { ...noEdge, L1: true } }),
    );
    furniture.push({ name: "Tortma yo'naltiruvchi (juft)", qty: p.drawers, unit: "juft" });
    furniture.push({ name: "Tortma taglik DVP", qty: p.drawers, unit: "dona", note: `${Math.round(innerW / Math.max(1, p.drawers) - 4 - 2 * t)} x ${dDepth} mm` });
    furniture.push({ name: "Ruchka (tortma)", qty: p.drawers, unit: "dona" });
    if (p.legHeight < 100) notes.push("Oyoq 100 mm dan past: sandiq tortmalar polga tegib qolishi mumkin.");
  }

  notes.push(`Karkas ichki o'lchami ${innerW} x ${innerL} mm (matras ${p.mattressWidth} x ${p.mattressLength} mm + ${clearance} mm zazor).`);
  return { parts, backPanelM2: 0, furniture, notes };
}

// ---------------------------------------------------------------- DIVAN

export type DivanParams = {
  thickness: number;
  length: number;
  depth: number;
  /** O'rindiq balandligi (polgacha, oyoq bilan) */
  seatHeight: number;
  backHeight: number;
  legType: BedLegType;
  legHeight: number;
};

export const DIVAN_DEFAULT: DivanParams = {
  thickness: 18,
  length: 2000,
  depth: 900,
  seatHeight: 450,
  backHeight: 800,
  legType: "yogoch",
  legHeight: 120,
};

export function buildDivan(p: DivanParams): BuildResult {
  const t = p.thickness;
  // Karkas oyoq ustida turadi
  const frameH = Math.max(100, p.seatHeight - p.legHeight);
  const parts: Part[] = [
    mk("Yon (qo'ltiq)", frameH, p.depth, 2, t, { edge: noEdge }),
    mk("Old/orqa tayanch", p.length - 2 * t, 150, 2, t, { edge: noEdge }),
    mk("O'rindiq asosi", p.length - 2 * t, p.depth - 2 * t, 1, t, { edge: noEdge }),
    mk("Suyanchiq ramka", p.length, p.backHeight - p.seatHeight, 1, t, { edge: noEdge }),
  ];
  const legs = p.length > 1800 ? 6 : 4;
  const furniture: FurnitureItem[] = [
    { name: "Karkas bruslar (40x40)", qty: Math.ceil((p.length * 2 + p.depth * 4) / 1000), unit: "m" },
    { name: "Ppu/ko'pik (o'rindiq)", qty: Math.round(((p.length * p.depth) / 1e6) * 100) / 100, unit: "m²", note: "qalinlik 100-150 mm" },
    { name: "Mato (taxminiy)", qty: Math.round(((p.length * p.depth * 2.2) / 1e6) * 100) / 100, unit: "m²", note: "o'rindiq + suyanchiq + yon, 10-15% zaxira bilan" },
    { name: BED_LEG_NAME[p.legType], qty: legs, unit: "dona", note: `${p.legHeight} mm` },
    { name: "Konfirmat (7x50)", qty: 12, unit: "dona" },
  ];
  const notes = [
    "Divan uchun hisob taxminiy: karkas LDSP/brus, yumshoq qism va qoplama usta konstruksiyasiga qarab farq qiladi.",
    "Mato va ko'pik miqdorini o'z tajribangizdan kelib chiqib tuzating.",
  ];
  return { parts, backPanelM2: 0, furniture, notes };
}
