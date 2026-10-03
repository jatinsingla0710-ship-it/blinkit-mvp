/**
 * Phase 13 — bill extract DTO + matching helpers.
 * Default extractor is manual/stub. Never claim AI accuracy.
 * Confirm path creates purchase DRAFT only (never receive).
 */

import type { GstSupplyType } from '@/data/gst';

export type BillExtractLine = {
  /** Raw text from bill / OCR stub. */
  description: string;
  quantity: number | null;
  unitCost: number | null;
  /** Exact sku_code when known. */
  skuCodeHint?: string | null;
  matchedSkuId?: string | null;
  matchConfidence?: 'exact' | 'partial' | 'none';
};

export type BillExtractDraft = {
  supplierNameHint?: string | null;
  supplierGstinHint?: string | null;
  matchedSupplierId?: string | null;
  supplierMatchConfidence?: 'exact' | 'partial' | 'none';
  billNumber?: string | null;
  purchaseDate?: string | null;
  taxAmount?: number | null;
  supplyType?: GstSupplyType | null;
  notes?: string | null;
  lines: BillExtractLine[];
  /** Honest label shown in UI — never "AI verified". */
  extractorLabel: string;
};

export type SupplierMatchCandidate = {
  id: string;
  name: string;
  gstin: string | null;
};

export type SkuMatchCandidate = {
  id: string;
  skuCode: string;
  name: string;
  productName?: string;
};

export function emptyBillExtract(
  extractorLabel = 'manual',
): BillExtractDraft {
  return {
    supplierNameHint: null,
    supplierGstinHint: null,
    matchedSupplierId: null,
    supplierMatchConfidence: 'none',
    billNumber: null,
    purchaseDate: null,
    taxAmount: 0,
    supplyType: 'UNSET',
    notes: null,
    lines: [],
    extractorLabel,
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeGstin(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

export function matchSupplierFromHints(
  suppliers: readonly SupplierMatchCandidate[],
  hints: {
    name?: string | null;
    gstin?: string | null;
  },
): {
  matchedSupplierId: string | null;
  supplierMatchConfidence: 'exact' | 'partial' | 'none';
} {
  const gstin = normalizeGstin(hints.gstin);
  if (gstin) {
    const exactGstin = suppliers.find(
      (s) => normalizeGstin(s.gstin) === gstin,
    );
    if (exactGstin) {
      return {
        matchedSupplierId: exactGstin.id,
        supplierMatchConfidence: 'exact',
      };
    }
  }

  const name = normalize(hints.name);
  if (!name) {
    return { matchedSupplierId: null, supplierMatchConfidence: 'none' };
  }

  const exactName = suppliers.find((s) => normalize(s.name) === name);
  if (exactName) {
    return {
      matchedSupplierId: exactName.id,
      supplierMatchConfidence: 'exact',
    };
  }

  const partial = suppliers.filter(
    (s) =>
      normalize(s.name).includes(name) || name.includes(normalize(s.name)),
  );
  if (partial.length === 1) {
    return {
      matchedSupplierId: partial[0]!.id,
      supplierMatchConfidence: 'partial',
    };
  }

  return { matchedSupplierId: null, supplierMatchConfidence: 'none' };
}

export function matchSkuFromHints(
  skus: readonly SkuMatchCandidate[],
  hints: {
    skuCode?: string | null;
    description?: string | null;
  },
): {
  matchedSkuId: string | null;
  matchConfidence: 'exact' | 'partial' | 'none';
} {
  const code = normalize(hints.skuCode);
  if (code) {
    const exact = skus.find((s) => normalize(s.skuCode) === code);
    if (exact) {
      return { matchedSkuId: exact.id, matchConfidence: 'exact' };
    }
  }

  const description = normalize(hints.description);
  if (!description) {
    return { matchedSkuId: null, matchConfidence: 'none' };
  }

  const exactName = skus.find(
    (s) =>
      normalize(s.name) === description ||
      normalize(s.productName) === description,
  );
  if (exactName) {
    return { matchedSkuId: exactName.id, matchConfidence: 'exact' };
  }

  const partial = skus.filter((s) => {
    const hay = `${normalize(s.name)} ${normalize(s.productName)} ${normalize(s.skuCode)}`;
    return hay.includes(description) || description.includes(normalize(s.name));
  });
  if (partial.length === 1) {
    return { matchedSkuId: partial[0]!.id, matchConfidence: 'partial' };
  }

  return { matchedSkuId: null, matchConfidence: 'none' };
}

/**
 * Apply deterministic matching onto an extract draft (mutates a copy).
 */
export function applyBillExtractMatches(
  extract: BillExtractDraft,
  suppliers: readonly SupplierMatchCandidate[],
  skus: readonly SkuMatchCandidate[],
): BillExtractDraft {
  const supplierMatch = matchSupplierFromHints(suppliers, {
    name: extract.supplierNameHint,
    gstin: extract.supplierGstinHint,
  });

  const lines = extract.lines.map((line) => {
    const skuMatch = matchSkuFromHints(skus, {
      skuCode: line.skuCodeHint,
      description: line.description,
    });
    return {
      ...line,
      matchedSkuId: skuMatch.matchedSkuId,
      matchConfidence: skuMatch.matchConfidence,
    };
  });

  return {
    ...extract,
    matchedSupplierId: supplierMatch.matchedSupplierId,
    supplierMatchConfidence: supplierMatch.supplierMatchConfidence,
    lines,
  };
}

/**
 * Manual / preview extractor — returns empty fields for owner entry.
 * A future LLM extractor can implement the same interface without changing confirm rules.
 */
export async function runManualBillExtractor(_input: {
  imageFileName?: string | null;
}): Promise<BillExtractDraft> {
  return emptyBillExtract('manual');
}

export function parseBillExtractJson(raw: unknown): BillExtractDraft {
  if (!raw || typeof raw !== 'object') return emptyBillExtract();
  const row = raw as Record<string, unknown>;
  const linesRaw = Array.isArray(row.lines) ? row.lines : [];
  return {
    supplierNameHint:
      typeof row.supplierNameHint === 'string' ? row.supplierNameHint : null,
    supplierGstinHint:
      typeof row.supplierGstinHint === 'string' ? row.supplierGstinHint : null,
    matchedSupplierId:
      typeof row.matchedSupplierId === 'string' ? row.matchedSupplierId : null,
    supplierMatchConfidence:
      row.supplierMatchConfidence === 'exact' ||
      row.supplierMatchConfidence === 'partial' ||
      row.supplierMatchConfidence === 'none'
        ? row.supplierMatchConfidence
        : 'none',
    billNumber: typeof row.billNumber === 'string' ? row.billNumber : null,
    purchaseDate:
      typeof row.purchaseDate === 'string' ? row.purchaseDate.slice(0, 10) : null,
    taxAmount:
      row.taxAmount == null || row.taxAmount === ''
        ? 0
        : Number(row.taxAmount) || 0,
    supplyType:
      row.supplyType === 'INTRA' ||
      row.supplyType === 'INTER' ||
      row.supplyType === 'UNSET'
        ? row.supplyType
        : 'UNSET',
    notes: typeof row.notes === 'string' ? row.notes : null,
    extractorLabel:
      typeof row.extractorLabel === 'string' && row.extractorLabel.trim()
        ? row.extractorLabel
        : 'manual',
    lines: linesRaw.map((line) => {
      const l = (line ?? {}) as Record<string, unknown>;
      return {
        description:
          typeof l.description === 'string' ? l.description : '',
        quantity:
          l.quantity == null || l.quantity === ''
            ? null
            : Number(l.quantity) || null,
        unitCost:
          l.unitCost == null || l.unitCost === ''
            ? null
            : Number(l.unitCost) || null,
        skuCodeHint:
          typeof l.skuCodeHint === 'string' ? l.skuCodeHint : null,
        matchedSkuId:
          typeof l.matchedSkuId === 'string' ? l.matchedSkuId : null,
        matchConfidence:
          l.matchConfidence === 'exact' ||
          l.matchConfidence === 'partial' ||
          l.matchConfidence === 'none'
            ? l.matchConfidence
            : 'none',
      };
    }),
  };
}

export type PurchaseBillScanStatus =
  | 'UPLOADED'
  | 'REVIEWING'
  | 'CONFIRMED'
  | 'DISCARDED';

export type PurchaseBillScanVm = {
  id: string;
  status: PurchaseBillScanStatus;
  imagePath: string | null;
  imageUrl: string | null;
  extract: BillExtractDraft;
  extractorLabel: string;
  purchaseId: string | null;
  notes: string | null;
  createdAtLabel: string;
};
