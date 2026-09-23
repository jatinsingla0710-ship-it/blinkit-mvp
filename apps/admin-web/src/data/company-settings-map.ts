import {
  parseCompanySettingsValue,
  parseCompanySettingsWriteValue,
  type CompanySettingsValue,
} from '@groaurum/validation';
import type { CompanyProfile } from '@/data/settings-types';

export function mapCompanySettingsToProfile(raw: unknown): CompanyProfile {
  return parseCompanySettingsValue(raw);
}

export function mapCompanySettingsToInvoiceCompany(raw: unknown): {
  companyName: string;
  sellerName: string;
  email: string;
  phoneLabel: string;
  businessAddress: string;
  logoUrl?: string;
  /** Present only when Company Settings has a GSTIN. */
  gstNumber?: string;
  /** Present only when Company Settings has a PAN. */
  pan?: string;
} {
  const company = parseCompanySettingsValue(raw);
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const explicitLogoUrl =
    typeof obj['logoUrl'] === 'string' ? obj['logoUrl'].trim() : '';
  const logoUrl = looksLikeUrl(company.logo)
    ? company.logo.trim()
    : looksLikeUrl(explicitLogoUrl)
      ? explicitLogoUrl
      : undefined;
  const gstNumber = company.gstNumber.trim();
  const pan = company.pan.trim();
  return {
    companyName: company.companyName,
    sellerName: company.companyName,
    email: emptyAsDash(company.email),
    phoneLabel: emptyAsDash(company.phone),
    businessAddress: emptyAsDash(company.address),
    ...(logoUrl ? { logoUrl } : {}),
    ...(gstNumber ? { gstNumber } : {}),
    ...(pan ? { pan } : {}),
  };
}

export function companyProfileToSettingsValue(
  profile: CompanyProfile,
): CompanySettingsValue {
  return parseCompanySettingsWriteValue(profile);
}

function emptyAsDash(value: string): string {
  return value.trim() ? value : '—';
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
