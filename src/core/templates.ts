import type { Part } from "./types.ts";

// Barcha o'lchamlar millimetrda.

export type FurnitureType = "shkaf" | "kupe" | "oshxona" | "krovat" | "divan";

export type FurnitureItem = { name: string; qty: number; unit: string; note?: string };

export type BuildResult = {
  /** LDSP detallari (qalinligi part.thickness bilan) */
  parts: Part[];
  /** Orqa devor DVP/HDF, m² (3 mm) */
  backPanelM2: number;
  /** Furnitura va boshqa sotib olinadigan buyumlar */
  furniture: FurnitureItem[];
  /** Hisobga kirmaydigan, ammo ustaga ko'rsatiladigan eslatmalar */
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
  /** Tsokol (oyoq) balandligi, mm. 0 = polga tegib turadi */
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
  plinth: 0,
};

/** Karkas: ikki yon, tepa, past, javonlar, orqa devor */
function carcass(p: ShkafParams, label = "") {
  const t = p.thickness;
  const inner = p.width - 2 * t;
  const parts: Part[] = [
    // Yon devorlar: tekstura vertikal (uzunlik bo'ylab)
    mk(`${label}Yon devor`, p.height - p.plinth, p.depth, 2, t, { grain: true, edge: frontEdge }),
    mk(`${label}Tepa`, inner, p.depth, 1, t, { edge: frontEdge }),
    mk(`${label}Past`, inner, p.depth, 1, t, { edge: frontEdge }),
  ];
  if (p.shelves > 0) {
    // Javon oldindan 20 mm ichkarida, orqa devor uchun joy qoldiriladi
    parts.push(mk(`${label}Javon`, inner - 2, p.depth - 20, p.shelves, t, { edge: frontEdge }));
  }
  return parts;
}

export function buildShkaf(p: ShkafParams): BuildResult {
  const t = p.thickness;
  const parts = carcass(p);
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];

  // Orqa devor DVP: karkasga 3 mm
  const backPanelM2 = ((p.width - 4) * (p.height - p.plinth - 4)) / 1e6;

  // Eshiklar: har tomonda 2 mm tirqish
  if (p.doors > 0) {
    const gap = 3;
    const doorW = Math.floor((p.width - gap * (p.doors + 1)) / p.doors);
    const doorH = p.height - p.plinth - 2 * gap;
    parts.push(mk("Eshik", doorH, doorW, p.doors, t, { grain: true, edge: allEdge }));
    const hp = hingesPerDoor(doorH);
    furniture.push({ name: "Sharnir (aylanma, 35 mm)", qty: hp * p.doors, unit: "dona" });
    furniture.push({ name: "Sharnir plankasi", qty: hp * p.doors, unit: "dona" });
    furniture.push({ name: "Ruchka", qty: p.doors, unit: "dona" });
  }

  if (p.drawers > 0) {
    const dW = p.width - 2 * t - 2 * 13; // 13 mm yo'naltiruvchi har tomonda
    const dDepth = p.depth - 50;
    const front = 180;
    // Tortma: old/orqa, ikki yon, taglik
    parts.push(
      mk("Tortma old (fasad)", dW + 2 * 13 - 4, front, p.drawers, t, { grain: true, edge: allEdge }),
      mk("Tortma yon", dDepth, front - 30, p.drawers * 2, t, { edge: { ...noEdge, L1: true } }),
      mk("Tortma orqa", dW - 2 * t, front - 30, p.drawers, t, { edge: { ...noEdge, L1: true } }),
    );
    furniture.push({ name: "Tortma yo'naltiruvchi (juft)", qty: p.drawers, unit: "juft" });
    furniture.push({ name: "Tortma taglik DVP", qty: p.drawers, unit: "dona", note: `${dW} x ${dDepth} mm` });
    furniture.push({ name: "Ruchka (tortma)", qty: p.drawers, unit: "dona" });
  }

  if (p.shelves > 0) {
    furniture.push({ name: "Javon tayanchi (polka tayanchi)", qty: p.shelves * 4, unit: "dona" });
  }
  // Birikmalar: minifiks yoki konfirmat
  const joints = 8 + p.shelves * 4; // 4 ta burchak ×2 + javonlar
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: joints, unit: "dona" });
  furniture.push({ name: "DVP mix (mix 3x16)", qty: Math.ceil(((p.width + p.height) * 2) / 150), unit: "dona", note: "orqa devor uchun, ~150 mm qadam" });
  if (p.plinth > 0) furniture.push({ name: "Oyoq (rostlanadigan)", qty: 4, unit: "dona", note: `${p.plinth} mm` });

  if (p.width > 900 && p.shelves > 0) {
    notes.push("Javon eni 900 mm dan katta: o'rtasida vertikal tayanch qo'yishni o'ylab ko'ring (egilish xavfi).");
  }
  if (p.height > 2000) notes.push("Balandlik 2000 mm dan oshdi: devorga mahkamlash uchun burchaklik kerak.");

  return { parts, backPanelM2, furniture, notes };
}

// ---------------------------------------------------------------- KUPE

export type KupeParams = ShkafParams & { sliding: number };

export const KUPE_DEFAULT: KupeParams = {
  ...SHKAF_DEFAULT,
  width: 1800,
  height: 2400,
  depth: 600,
  doors: 0,
  sliding: 2,
};

export function buildKupe(p: KupeParams): BuildResult {
  const t = p.thickness;
  const parts = carcass({ ...p, doors: 0 });
  const furniture: FurnitureItem[] = [];
  const notes: string[] = [];
  const backPanelM2 = ((p.width - 4) * (p.height - p.plinth - 4)) / 1e6;

  const n = Math.max(2, p.sliding);
  const overlap = 30; // yonma-yon eshiklar bir-birini qoplashi
  const rail = 45; // ustki/pastki yo'naltiruvchi balandligi
  const doorW = (p.width - 2 * t + overlap * (n - 1)) / n;
  const doorH = p.height - p.plinth - 2 * t - rail - 5;
  parts.push(mk("Kupe eshik (ramka ichiga)", doorH, doorW, n, t, { grain: true, edge: allEdge }));

  furniture.push({ name: "Kupe tizimi (ustki + pastki rels)", qty: 1, unit: "komplekt", note: `eni ${p.width - 2 * t} mm, ${n} ta eshik` });
  furniture.push({ name: "Rolik (g'ildirak) komplekti", qty: n, unit: "komplekt" });
  furniture.push({ name: "Eshik profili (qo'l ushlagich)", qty: n, unit: "komplekt" });
  if (p.shelves > 0) furniture.push({ name: "Javon tayanchi", qty: p.shelves * 4, unit: "dona" });
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: 8 + p.shelves * 4, unit: "dona" });
  furniture.push({ name: "DVP mix (3x16)", qty: Math.ceil(((p.width + p.height) * 2) / 150), unit: "dona" });

  notes.push("Eshik o'lchami tizim ishlab chiqaruvchisining jadvaliga qarab tekshirilsin: har brend ruxsat etgan balandlik va og'irligi farq qiladi.");
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
  /** Pastki tumba balandligi (tsokolsiz), mm */
  baseHeight: number;
  baseDepth: number;
  wallHeight: number;
  wallDepth: number;
  plinth: number;
  modules: KitchenModule[];
};

export const OSHXONA_DEFAULT: OshxonaParams = {
  thickness: 16,
  baseHeight: 720,
  baseDepth: 560,
  wallHeight: 720,
  wallDepth: 320,
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

  p.modules.forEach((m, i) => {
    const base = m.kind === "past";
    const H = base ? p.baseHeight : p.wallHeight;
    const D = base ? p.baseDepth : p.wallDepth;
    const label = `${base ? "Past" : "Yuqori"} #${i + 1}: `;
    const inner = m.width - 2 * t;

    parts.push(mk(`${label}Yon devor`, H, D, 2, t, { grain: true, edge: frontEdge }));
    parts.push(mk(`${label}Past`, inner, D, 1, t, { edge: frontEdge }));
    if (base) {
      // Pastki tumbada ustki qism: 2 ta planka (orqa va old), stoleshnitsa ustiga
      parts.push(mk(`${label}Ustki planka`, inner, 100, 2, t, { edge: noEdge }));
      counterMm += m.width;
    } else {
      parts.push(mk(`${label}Tepa`, inner, D, 1, t, { edge: frontEdge }));
    }
    if (m.shelves > 0) {
      parts.push(mk(`${label}Javon`, inner - 2, D - 20, m.shelves, t, { edge: frontEdge }));
      furniture.push({ name: `Javon tayanchi (${label.trim()})`, qty: m.shelves * 4, unit: "dona" });
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
    joints += 8 + m.shelves * 4;
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
  if (nBase > 0) {
    furniture.push({ name: "Oyoq (rostlanadigan)", qty: nBase * 4, unit: "dona", note: `${p.plinth} mm` });
    furniture.push({ name: "Stoleshnitsa", qty: Math.round(counterMm) / 1000, unit: "m (uzunlik)", note: "eni ~600 mm, LDSP emas — alohida material" });
    furniture.push({ name: "Tsokol planka", qty: Math.round(counterMm) / 1000, unit: "m", note: `${p.plinth} mm balandlik` });
  }
  furniture.push({ name: "Osma shkaf mahkamlagichi", qty: p.modules.filter((m) => m.kind === "yuqori").length * 2, unit: "dona" });

  notes.push("Stoleshnitsa, fartuk (devor oralig'i) va texnika uchun kesimlar alohida o'lchanadi.");
  notes.push("Plita/moyka uchun tumba kesimi va gaz/suv quvurlari bu hisobga kirmagan.");

  return { parts, backPanelM2: backM2, furniture, notes };
}

// ---------------------------------------------------------------- KROVAT

export type KrovatParams = {
  thickness: number;
  /** Matras o'lchami */
  mattressWidth: number;
  mattressLength: number;
  /** Ramka balandligi (yon taxta) */
  railHeight: number;
  /** Bosh taxta balandligi (polgacha emas, ramka ustidan), 0 = yo'q */
  headboard: number;
  /** Ostida tortma (sandiq) */
  drawers: number;
};

export const KROVAT_DEFAULT: KrovatParams = {
  thickness: 18,
  mattressWidth: 1600,
  mattressLength: 2000,
  railHeight: 250,
  headboard: 600,
  drawers: 0,
};

export function buildKrovat(p: KrovatParams): BuildResult {
  const t = p.thickness;
  const clearance = 20; // matras atrofida bo'sh joy
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
  if (p.mattressWidth >= 1400) {
    parts.push(mk("O'rta tayanch (balka)", innerL, 100, 1, t, { edge: noEdge }));
    furniture.push({ name: "O'rta tayanch oyog'i", qty: 2, unit: "dona" });
  }
  // Ramka ichiga reyka (lamel) tayanch relslari
  parts.push(mk("Lamel tayanch reyka", innerL, 50, 2, t, { edge: noEdge }));

  const slatPitch = 90; // lamel markazlari orasi
  const slats = Math.ceil(innerL / slatPitch);
  furniture.push({ name: "Lamel (reyka)", qty: slats, unit: "dona", note: `${innerW} mm, taxminan ${slatPitch} mm qadam` });
  furniture.push({ name: "Krovat oyog'i", qty: 4, unit: "dona" });
  furniture.push({ name: "Burchak mahkamlagich (krovat bolti)", qty: 8, unit: "dona" });
  furniture.push({ name: "Konfirmat (7x50) yoki minifiks", qty: 12, unit: "dona" });

  if (p.drawers > 0) {
    const dDepth = Math.min(innerL - 200, 900);
    parts.push(
      mk("Sandiq tortma fasad", innerW / Math.max(1, p.drawers) - 4, p.railHeight - 20, p.drawers, t, { edge: allEdge }),
      mk("Sandiq tortma yon", dDepth, p.railHeight - 60, p.drawers * 2, t, { edge: { ...noEdge, L1: true } }),
    );
    furniture.push({ name: "Tortma yo'naltiruvchi (juft)", qty: p.drawers, unit: "juft" });
  }

  notes.push(`Karkas ichki o'lchami ${innerW} x ${innerL} mm (matras ${p.mattressWidth} x ${p.mattressLength} mm + ${clearance} mm zazor).`);
  return { parts, backPanelM2: 0, furniture, notes };
}

// ---------------------------------------------------------------- DIVAN

export type DivanParams = {
  thickness: number;
  length: number;
  depth: number;
  seatHeight: number;
  backHeight: number;
};

export const DIVAN_DEFAULT: DivanParams = {
  thickness: 18,
  length: 2000,
  depth: 900,
  seatHeight: 450,
  backHeight: 800,
};

export function buildDivan(p: DivanParams): BuildResult {
  const t = p.thickness;
  const parts: Part[] = [
    mk("Yon (qo'ltiq)", p.seatHeight, p.depth, 2, t, { edge: noEdge }),
    mk("Old/orqa tayanch", p.length - 2 * t, 150, 2, t, { edge: noEdge }),
    mk("O'rindiq asosi", p.length - 2 * t, p.depth - 2 * t, 1, t, { edge: noEdge }),
    mk("Suyanchiq ramka", p.length, p.backHeight - p.seatHeight, 1, t, { edge: noEdge }),
  ];
  const furniture: FurnitureItem[] = [
    { name: "Karkas bruslar (40x40)", qty: Math.ceil((p.length * 2 + p.depth * 4) / 1000), unit: "m" },
    { name: "Ppu/ko'pik (o'rindiq)", qty: Math.round(((p.length * p.depth) / 1e6) * 100) / 100, unit: "m²", note: "qalinlik 100-150 mm" },
    { name: "Mato (taxminiy)", qty: Math.round(((p.length * p.depth * 2.2) / 1e6) * 100) / 100, unit: "m²", note: "o'rindiq + suyanchiq + yon, 10-15% zaxira bilan" },
    { name: "Oyoq", qty: 4, unit: "dona" },
    { name: "Konfirmat (7x50)", qty: 12, unit: "dona" },
  ];
  const notes = [
    "Divan uchun hisob taxminiy: karkas LDSP/brus, yumshoq qism va qoplama usta konstruksiyasiga qarab farq qiladi.",
    "Mato va ko'pik miqdorini o'z tajribangizdan kelib chiqib tuzating.",
  ];
  return { parts, backPanelM2: 0, furniture, notes };
}
