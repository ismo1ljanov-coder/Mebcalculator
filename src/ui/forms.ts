import {
  SHKAF_DEFAULT,
  KUPE_DEFAULT,
  OSHXONA_DEFAULT,
  KROVAT_DEFAULT,
  DIVAN_DEFAULT,
  buildShkaf,
  buildKupe,
  buildOshxona,
  buildKrovat,
  buildDivan,
} from "../core/templates.ts";
import type { BuildResult, FurnitureType, KitchenModule, LegType, BedLegType } from "../core/templates.ts";
import type { Prices } from "../core/calculator.ts";

export type Field = {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Kichik sonlar uchun +/- tugmali maydon */
  stepper?: boolean;
};

export type Group = { title: string; cols: 2 | 3; fields: Field[] };

export const TYPE_LABELS: Record<FurnitureType, string> = {
  shkaf: "Shkaf",
  kupe: "Kupe",
  oshxona: "Oshxona",
  krovat: "Krovat",
  divan: "Divan",
};

/** Eshik/fasad ranglari (vizual; narx va hisobga ta'sir qilmaydi) */
export const FINISHES = [
  { id: "krem", label: "Krem", hex: "#efe7d6" },
  { id: "oq", label: "Oq", hex: "#f6f5f1" },
  { id: "kulrang", label: "Kulrang", hex: "#a9afb2" },
  { id: "grafit", label: "Grafit", hex: "#4b545a" },
  { id: "eman", label: "Eman", hex: "#c49b62" },
  { id: "yashil", label: "Yashil", hex: "#6f9488" },
] as const;
export function finishHex(id: string): string {
  return (FINISHES.find((f) => f.id === id) ?? FINISHES[0]).hex;
}
export const HANDLE_STYLES = [
  { id: "ruchka", label: "Ruchka bilan" },
  { id: "profil", label: "Ruchkasiz (profil)" },
] as const;

export const THICKNESSES = [16, 18, 22] as const;

const W = (min: number, max: number): Field => ({ key: "width", label: "Eni", unit: "mm", min, max });
const H = (min: number, max: number): Field => ({ key: "height", label: "Balandligi", unit: "mm", min, max });
const D = (min: number, max: number): Field => ({ key: "depth", label: "Chuqurligi", unit: "mm", min, max });
const N = (key: string, label: string, max: number, min = 0): Field => ({ key, label, unit: "ta", min, max, stepper: true });

export const GROUPS: Record<Exclude<FurnitureType, "oshxona">, Group[]> = {
  shkaf: [
    { title: "O'lchamlar", cols: 3, fields: [W(300, 4000), H(300, 2800), D(200, 800)] },
    { title: "Ichki tuzilma", cols: 3, fields: [N("shelves", "Javon", 12), N("doors", "Eshik", 6), N("drawers", "Tortma", 8)] },
    { title: "Qo'shimcha", cols: 3, fields: [N("rods", "Shtanga (kiyim osish)", 4)] },
  ],
  kupe: [
    { title: "O'lchamlar", cols: 3, fields: [W(800, 4500), H(1500, 2800), D(300, 800)] },
    { title: "Ichki tuzilma", cols: 3, fields: [N("sliding", "Kupe eshik", 5, 2), N("shelves", "Javon", 12), N("drawers", "Tortma", 8)] },
    { title: "Qo'shimcha", cols: 3, fields: [N("rods", "Shtanga (kiyim osish)", 4), { key: "antresol", label: "Antresol (0 = yo'q)", unit: "mm", min: 0, max: 800 }] },
  ],
  krovat: [
    {
      title: "Matras o'lchami",
      cols: 2,
      fields: [
        { key: "mattressWidth", label: "Eni", unit: "mm", min: 700, max: 2200 },
        { key: "mattressLength", label: "Uzunligi", unit: "mm", min: 1500, max: 2200 },
      ],
    },
    {
      title: "Karkas",
      cols: 3,
      fields: [
        { key: "railHeight", label: "Yon taxta", unit: "mm", min: 100, max: 500 },
        { key: "headboard", label: "Bosh taxta (0 = yo'q)", unit: "mm", min: 0, max: 1200 },
        N("drawers", "Sandiq tortma", 4),
      ],
    },
  ],
  divan: [
    {
      title: "O'lchamlar",
      cols: 2,
      fields: [
        { key: "length", label: "Uzunligi", unit: "mm", min: 800, max: 3500 },
        D(600, 1200),
        { key: "seatHeight", label: "O'rindiq balandligi", unit: "mm", min: 300, max: 600 },
        { key: "backHeight", label: "Suyanchiq balandligi", unit: "mm", min: 500, max: 1100 },
      ],
    },
  ],
};

export const KITCHEN_GROUPS: Group[] = [
  {
    title: "Tumba va shkaf o'lchamlari",
    cols: 2,
    fields: [
      { key: "baseHeight", label: "Pastki tumba balandligi", unit: "mm", min: 600, max: 900 },
      { key: "baseDepth", label: "Pastki tumba chuqurligi", unit: "mm", min: 400, max: 700 },
      { key: "wallHeight", label: "Yuqori shkaf balandligi", unit: "mm", min: 300, max: 1100 },
      { key: "wallDepth", label: "Yuqori shkaf chuqurligi", unit: "mm", min: 200, max: 450 },
      { key: "tallHeight", label: "Penal (baland ustun) balandligi", unit: "mm", min: 1800, max: 2700 },
    ],
  },
];

export const MODULE_FIELDS: Field[] = [
  { key: "width", label: "Eni", unit: "mm", min: 200, max: 1200 },
  N("doors", "Eshik", 3),
  N("drawers", "Tortma", 5),
  N("shelves", "Javon", 5),
];

/** Tez tanlash uchun odatiy o'lchamlar */
export const WIDTH_PRESETS: Record<"shkaf" | "kupe", number[]> = {
  shkaf: [600, 800, 1000, 1200, 1500, 1800],
  kupe: [1500, 1800, 2000, 2400, 3000],
};
export const MATTRESS_PRESETS: [number, number][] = [
  [900, 2000],
  [1200, 2000],
  [1400, 2000],
  [1600, 2000],
  [1800, 2000],
];

export const FRAME_LEGS: { id: LegType; label: string; hint: string }[] = [
  { id: "yoq", label: "Oyoqsiz", hint: "Polga tegib turadi" },
  { id: "tsokol", label: "Tsokol", hint: "Old planka + rostlanadigan oyoq" },
  { id: "nikel", label: "Nikel oyoq", hint: "Ochiq metall oyoq" },
];
export const BED_LEGS: { id: BedLegType; label: string }[] = [
  { id: "yogoch", label: "Yog'och" },
  { id: "nikel", label: "Nikel" },
  { id: "plastik", label: "Plastik" },
];
/** Oyoq turini almashtirganda tavsiya qilinadigan balandlik, mm */
export const SUGGESTED_LEG_HEIGHT: Record<LegType, number> = { yoq: 0, tsokol: 100, nikel: 150 };

export type AppState = {
  type: FurnitureType;
  /** Loyiha yoki mijoz nomi (chop etishda ko'rinadi) */
  title: string;
  params: {
    shkaf: typeof SHKAF_DEFAULT;
    kupe: typeof KUPE_DEFAULT;
    oshxona: typeof OSHXONA_DEFAULT;
    krovat: typeof KROVAT_DEFAULT;
    divan: typeof DIVAN_DEFAULT;
  };
  sheet: { length: number; width: number; kerf: number; trim: number };
  prices: Prices;
};

export function defaultState(): AppState {
  return {
    type: "shkaf",
    title: "",
    params: {
      shkaf: { ...SHKAF_DEFAULT, legType: "tsokol", plinth: 100 },
      kupe: { ...KUPE_DEFAULT, legType: "tsokol", plinth: 100 },
      oshxona: { ...OSHXONA_DEFAULT, modules: OSHXONA_DEFAULT.modules.map((m) => ({ ...m })) },
      krovat: { ...KROVAT_DEFAULT },
      divan: { ...DIVAN_DEFAULT },
    },
    sheet: { length: 2750, width: 1830, kerf: 4, trim: 10 },
    // Narxlar ataylab 0: bozor narxlarini taxmin qilmaymiz, usta o'zinikini kiritadi.
    prices: {
      sheetByThickness: { 16: 0, 18: 0, 22: 0 },
      edgePerMeter: 0,
      backPanelSheet: 0,
      labor: { mode: "percent", value: 0 },
      marginPercent: 0,
    },
  };
}

export function clamp(v: number, f: { min: number; max: number }): number {
  if (!Number.isFinite(v)) return f.min;
  return Math.min(f.max, Math.max(f.min, Math.round(v)));
}

export function buildFor(state: AppState): BuildResult {
  switch (state.type) {
    case "shkaf":
      return buildShkaf(state.params.shkaf);
    case "kupe":
      return buildKupe(state.params.kupe);
    case "oshxona":
      return buildOshxona(state.params.oshxona);
    case "krovat":
      return buildKrovat(state.params.krovat);
    case "divan":
      return buildDivan(state.params.divan);
  }
}

export const NEW_MODULE: KitchenModule = { kind: "past", width: 600, doors: 1, drawers: 0, shelves: 1 };

/** Joriy turdagi parametrlarni umumiy ko'rinishda qaytaradi (forma va saqlash uchun) */
export function currentParams(state: AppState): Record<string, number | string> {
  return state.params[state.type] as unknown as Record<string, number | string>;
}
