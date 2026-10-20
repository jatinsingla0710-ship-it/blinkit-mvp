/**
 * Browse shows the current trade price. The server preview can return a
 * different pack price for the chosen quantity. This only compares those two
 * numbers; it does not choose a tier or recompute the line.
 */

const PAISA = 0.01;

function rupees(value: number): number {
  return Math.round(value * 100) / 100;
}

export function catalogueListPriceNote(
  listPackPrice: number,
  previewUnitPrice: number | null | undefined,
): string | null {
  if (!Number.isFinite(listPackPrice)) return null;
  if (previewUnitPrice == null || !Number.isFinite(previewUnitPrice)) return null;
  if (Math.abs(rupees(listPackPrice) - rupees(previewUnitPrice)) < PAISA) {
    return null;
  }
  return 'This quantity uses a different price than the list price.';
}
