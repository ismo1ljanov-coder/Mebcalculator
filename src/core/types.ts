// Barcha o'lchamlar millimetrda.

export type Part = {
  id: string;
  name: string;
  /** Detal uzunligi (mm) */
  length: number;
  /** Detal eni (mm) */
  width: number;
  qty: number;
  /** Material qalinligi (mm), masalan 16 yoki 18 */
  thickness: number;
  /**
   * true bo'lsa, tekstura (tola) yo'nalishi bo'yicha aylantirib bo'lmaydi:
   * detalning `length` tomoni list uzunligiga parallel turadi.
   */
  grain: boolean;
  /** Kant (qirra yelim) qaysi tomonlarga: L1, L2 = uzun tomonlar, W1, W2 = qisqa tomonlar */
  edge: { L1: boolean; L2: boolean; W1: boolean; W2: boolean };
};

export type Sheet = {
  length: number; // masalan 2750
  width: number; // masalan 1830
  thickness: number;
  /** Arra qalinligi (kerf), mm */
  kerf: number;
  /** List chetidan kesib tashlanadigan qirra (trim), mm */
  trim: number;
};

export type Placement = {
  partId: string;
  name: string;
  /** Instans raqami (qty bo'yicha) */
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
};

export type PackedSheet = {
  placements: Placement[];
  usedArea: number; // mm²
  sheetArea: number; // mm²
};

export type PackResult = {
  sheets: PackedSheet[];
  unplaced: { partId: string; name: string; index: number }[];
  totalUsedArea: number;
  totalSheetArea: number;
  /** Foydalanish foizi (0..100) */
  utilization: number;
  /** Qoldiq foizi (0..100) */
  waste: number;
};
