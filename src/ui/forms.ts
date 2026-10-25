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
import type { BuildResult, FurnitureType, KitchenModule } from "../core/templates.ts";
import type { Prices } from "../core/calculator.ts";

export type Field = {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
};

export const TYPE_LABELS: Record<FurnitureType, string> = {
  shkaf: "Shkaf",
  kupe: "Kupe",
  oshxona: "Oshxona",
  krovat: "Krovat",
  divan: "Divan",
};

const T: Field = { key: "thickness", label: "LDSP qalinligi", unit: "mm", min: 10, max: 25 };

export const FIELDS: Record<Exclude<FurnitureType, "oshxona">, Field[]> = {
  shkaf: [
    { key: "width", label: "Eni", unit: "mm", min: 300, max: 4000 },
    { key: "height", label: "Balandligi", unit: "mm", min: 300, max: 2800 },
    { key: "depth", label: "Chuqurligi", unit: "mm", min: 200, max: 800 },
    T,
    { key: "shelves", label: "Javonlar soni", unit: "ta", min: 0, max: 12 },
    { key: "doors", label: "Eshiklar soni", unit: "ta", min: 0, max: 6 },
    { key: "drawers", label: "Tortmalar soni", unit: "ta", min: 0, max: 8 },
    { key: "plinth", label: "Oyoq balandligi", unit: "mm", min: 0, max: 200 },
  ],
  kupe: [
    { key: "width", label: "Eni", unit: "mm", min: 800, max: 4500 },
    { key: "height", label: "Balandligi", unit: "mm", min: 1500, max: 2800 },
    { key: "depth", label: "Chuqurligi", unit: "mm", min: 300, max: 800 },
    T,
    { key: "sliding", label: "Kupe eshiklari soni", unit: "ta", min: 2, max: 5 },
    { key: "shelves", label: "Javonlar soni", unit: "ta", min: 0, max: 12 },
    { key: "drawers", label: "Tortmalar soni", unit: "ta", min: 0, max: 8 },
    { key: "plinth", label: "Oyoq balandligi", unit: "mm", min: 0, max: 200 },
  ],
  krovat: [
    { key: "mattressWidth", label: "Matras eni", unit: "mm", min: 700, max: 2200 },
    { key: "mattressLength", label: "Matras uzunligi", unit: "mm", min: 1500, max: 2200 },
    T,
    { key: "railHeight", label: "Yon taxta balandligi", unit: "mm", min: 100, max: 500 },
    { key: "headboard", label: "Bosh taxta balandligi (0 = yo'q)", unit: "mm", min: 0, max: 1200 },
    { key: "drawers", label: "Sandiq tortmalar soni", unit: "ta", min: 0, max: 4 },
  ],
  divan: [
    { key: "length", label: "Uzunligi", unit: "mm", min: 800, max: 3500 },
    { key: "depth", label: "Chuqurligi", unit: "mm", min: 600, max: 1200 },
    { key: "seatHeight", label: "O'rindiq balandligi", unit: "mm", min: 300, max: 600 },
    { key: "backHeight", label: "Suyanchiq balandligi", unit: "mm", min: 500, max: 1100 },
    T,
  ],
};

export const KITCHEN_FIELDS: Field[] = [
  { key: "baseHeight", label: "Pastki tumba balandligi", unit: "mm", min: 600, max: 900 },
  { key: "baseDepth", label: "Pastki tumba chuqurligi", unit: "mm", min: 400, max: 700 },
  { key: "wallHeight", label: "Yuqori shkaf balandligi", unit: "mm", min: 300, max: 1100 },
  { key: "wallDepth", label: "Yuqori shkaf chuqurligi", unit: "mm", min: 200, max: 450 },
  { key: "plinth", label: "Oyoq balandligi", unit: "mm", min: 0, max: 200 },
  T,
];

export const MODULE_FIELDS: Field[] = [
  { key: "width", label: "Eni", unit: "mm", min: 200, max: 1200 },
  { key: "doors", label: "Eshik", unit: "ta", min: 0, max: 3 },
  { key: "drawers", label: "Tortma", unit: "ta", min: 0, max: 5 },
  { key: "shelves", label: "Javon", unit: "ta", min: 0, max: 5 },
];

export type AppState = {
  type: FurnitureType;
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
    params: {
      shkaf: { ...SHKAF_DEFAULT },
      kupe: { ...KUPE_DEFAULT },
      oshxona: { ...OSHXONA_DEFAULT, modules: OSHXONA_DEFAULT.modules.map((m) => ({ ...m })) },
      krovat: { ...KROVAT_DEFAULT },
      divan: { ...DIVAN_DEFAULT },
    },
    sheet: { length: 2750, width: 1830, kerf: 4, trim: 10 },
    // Narxlar ataylab 0: bozor narxlarini taxmin qilmaymiz, usta o'zinikini kiritadi.
    prices: {
      sheetByThickness: { 16: 0, 18: 0 },
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
