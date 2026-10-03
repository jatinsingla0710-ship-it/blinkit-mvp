/**
 * Phase 9 — GST tax summary from purchase GST splits + Books input accounts.
 * Honesty: this is an internal summary, not a GSTR filing export.
 */

import { formatInr } from '@/data/live/format';
import type { GstSupplyType } from '@/data/gst';

export type GstPurchaseTaxRow = {
  id: string;
  billNumber: string;
  purchaseDate: string;
  purchaseDateLabel: string;
  supplierName: string;
  supplyType: GstSupplyType;
  taxableValue: number;
  taxableValueLabel: string;
  cgstAmount: number;
  cgstAmountLabel: string;
  sgstAmount: number;
  sgstAmountLabel: string;
  igstAmount: number;
  igstAmountLabel: string;
  taxAmount: number;
  taxAmountLabel: string;
};

export type GstTaxSummaryVm = {
  generatedAtLabel: string;
  rangeLabel: string;
  purchaseCount: number;
  taxableValue: number;
  taxableValueLabel: string;
  cgstInput: number;
  cgstInputLabel: string;
  sgstInput: number;
  sgstInputLabel: string;
  igstInput: number;
  igstInputLabel: string;
  unclassifiedInput: number;
  unclassifiedInputLabel: string;
  totalInputTax: number;
  totalInputTaxLabel: string;
  outputTaxNote: string;
  disclaimer: string;
  rows: GstPurchaseTaxRow[];
};

export function buildGstTaxSummary(input: {
  generatedAtLabel: string;
  rangeLabel: string;
  purchases: Array<{
    id: string;
    billNumber: string;
    purchaseDate: string;
    purchaseDateLabel: string;
    supplierName: string;
    supplyType: string;
    subtotal: number;
    taxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  }>;
}): GstTaxSummaryVm {
  const rows: GstPurchaseTaxRow[] = [];
  let taxableValue = 0;
  let cgstInput = 0;
  let sgstInput = 0;
  let igstInput = 0;
  let unclassifiedInput = 0;

  for (const p of input.purchases) {
    const supplyRaw = (p.supplyType || 'UNSET').toUpperCase();
    const supplyType: GstSupplyType =
      supplyRaw === 'INTRA' || supplyRaw === 'INTER' || supplyRaw === 'UNSET'
        ? supplyRaw
        : 'UNSET';
    const cgst = Number(p.cgstAmount) || 0;
    const sgst = Number(p.sgstAmount) || 0;
    const igst = Number(p.igstAmount) || 0;
    const tax = Number(p.taxAmount) || 0;
    const split = cgst + sgst + igst;
    if (tax > 0 && split <= 0) {
      unclassifiedInput += tax;
    } else {
      cgstInput += cgst;
      sgstInput += sgst;
      igstInput += igst;
    }
    taxableValue += Number(p.subtotal) || 0;
    rows.push({
      id: p.id,
      billNumber: p.billNumber,
      purchaseDate: p.purchaseDate,
      purchaseDateLabel: p.purchaseDateLabel,
      supplierName: p.supplierName,
      supplyType,
      taxableValue: Number(p.subtotal) || 0,
      taxableValueLabel: formatInr(Number(p.subtotal) || 0),
      cgstAmount: cgst,
      cgstAmountLabel: formatInr(cgst),
      sgstAmount: sgst,
      sgstAmountLabel: formatInr(sgst),
      igstAmount: igst,
      igstAmountLabel: formatInr(igst),
      taxAmount: tax,
      taxAmountLabel: formatInr(tax),
    });
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  taxableValue = round(taxableValue);
  cgstInput = round(cgstInput);
  sgstInput = round(sgstInput);
  igstInput = round(igstInput);
  unclassifiedInput = round(unclassifiedInput);
  const totalInputTax = round(
    cgstInput + sgstInput + igstInput + unclassifiedInput,
  );

  return {
    generatedAtLabel: input.generatedAtLabel,
    rangeLabel: input.rangeLabel,
    purchaseCount: rows.length,
    taxableValue,
    taxableValueLabel: formatInr(taxableValue),
    cgstInput,
    cgstInputLabel: formatInr(cgstInput),
    sgstInput,
    sgstInputLabel: formatInr(sgstInput),
    igstInput,
    igstInputLabel: formatInr(igstInput),
    unclassifiedInput,
    unclassifiedInputLabel: formatInr(unclassifiedInput),
    totalInputTax,
    totalInputTaxLabel: formatInr(totalInputTax),
    outputTaxNote:
      'Output tax (sales CGST/SGST/IGST) is not posted yet — sale prices remain as charged without a separate GST split.',
    disclaimer:
      'Internal GST summary from received purchases. Not a GSTR-1/3B filing export. Update Books after receiving purchases.',
    rows,
  };
}
