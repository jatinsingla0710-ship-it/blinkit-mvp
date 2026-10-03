/**
 * Phase 9 — India GST helpers (foundation).
 * Does NOT claim GST return / e-invoice compliance.
 */

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Normalize GSTIN for storage/compare (uppercase, strip spaces). */
export function normalizeGstin(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/\s+/g, '').toUpperCase();
  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Structural GSTIN check (15 chars, state + PAN pattern).
 * Does not verify against the GST portal.
 */
export function isValidGstin(raw: string | null | undefined): boolean {
  const gstin = normalizeGstin(raw);
  if (!gstin) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
}

/** First two digits of GSTIN = state code (e.g. 07 = Delhi). */
export function stateCodeFromGstin(
  raw: string | null | undefined,
): string | null {
  const gstin = normalizeGstin(raw);
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export type GstSupplyType = 'INTRA' | 'INTER' | 'UNSET';

export const GST_SUPPLY_TYPE_LABELS: Record<GstSupplyType, string> = {
  INTRA: 'Same state (CGST + SGST)',
  INTER: 'Other state (IGST)',
  UNSET: 'Not set',
};

/** Compare seller vs counterparty state codes (2-digit). */
export function classifyGstSupplyType(
  sellerStateCode: string | null | undefined,
  counterpartyStateCode: string | null | undefined,
): GstSupplyType {
  const a = (sellerStateCode ?? '').trim();
  const b = (counterpartyStateCode ?? '').trim();
  if (!/^\d{2}$/.test(a) || !/^\d{2}$/.test(b)) return 'UNSET';
  return a === b ? 'INTRA' : 'INTER';
}

export type GstTaxSplit = {
  supplyType: GstSupplyType;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
};

/**
 * Split a total tax amount into CGST/SGST or IGST.
 * Odd paise go to CGST on intra-state splits.
 */
export function splitGstTaxAmount(
  taxAmount: number,
  supplyType: GstSupplyType,
): GstTaxSplit {
  const tax = roundMoney(Math.max(0, Number(taxAmount) || 0));
  if (tax === 0 || supplyType === 'UNSET') {
    return {
      supplyType,
      taxAmount: tax,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    };
  }
  if (supplyType === 'INTER') {
    return {
      supplyType,
      taxAmount: tax,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: tax,
    };
  }
  const half = roundMoney(tax / 2);
  const cgst = roundMoney(tax - half);
  return {
    supplyType: 'INTRA',
    taxAmount: tax,
    cgstAmount: cgst,
    sgstAmount: half,
    igstAmount: 0,
  };
}

/** Ensure component sum matches header tax (within 1 paise). */
export function gstComponentsMatchTax(input: {
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}): boolean {
  const tax = roundMoney(input.taxAmount);
  const sum = roundMoney(
    (Number(input.cgstAmount) || 0) +
      (Number(input.sgstAmount) || 0) +
      (Number(input.igstAmount) || 0),
  );
  if (tax === 0) return sum === 0;
  return Math.abs(tax - sum) < 0.015;
}

/** Optional GSTIN field: blank OK; non-blank must pass structural check. */
export function parseOptionalGstin(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const normalized = normalizeGstin(raw);
  if (!normalized) return { ok: true, value: null };
  if (!isValidGstin(normalized)) {
    return {
      ok: false,
      error: 'Enter a valid 15-character GSTIN, or leave blank',
    };
  }
  return { ok: true, value: normalized };
}

export const GST_INPUT_CGST_CODE = '1310';
export const GST_INPUT_SGST_CODE = '1320';
export const GST_INPUT_IGST_CODE = '1330';
export const GST_INPUT_CLEARING_CODE = '1300';
export const GST_OUTPUT_CGST_CODE = '2100';
export const GST_OUTPUT_SGST_CODE = '2110';
export const GST_OUTPUT_IGST_CODE = '2120';
