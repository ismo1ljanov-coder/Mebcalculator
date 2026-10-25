import type { Part } from "./types.ts";

/**
 * Kant (qirra yelim) uzunligini metrda hisoblaydi.
 * Har bir detalning belgilangan tomonlari qty ga ko'paytiriladi.
 * `waste` – kant lentasi sarfi uchun zaxira (odatda 5–10%).
 */
export function edgeLengthMeters(parts: Part[], waste = 0.07): { net: number; withWaste: number } {
  let mm = 0;
  for (const p of parts) {
    const per =
      (p.edge.L1 ? p.length : 0) +
      (p.edge.L2 ? p.length : 0) +
      (p.edge.W1 ? p.width : 0) +
      (p.edge.W2 ? p.width : 0);
    mm += per * p.qty;
  }
  const net = mm / 1000;
  return { net, withWaste: net * (1 + waste) };
}
