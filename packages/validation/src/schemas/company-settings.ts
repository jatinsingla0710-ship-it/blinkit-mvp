import { z } from 'zod';
import { nonEmptyString } from './crud';

/** Stable settings.setting_key for the company profile JSON document. */
export const COMPANY_SETTING_KEY = 'company' as const;

/**
 * Canonical company JSON stored in settings.setting_value.
 * Read + write + invoice mapping must use these keys only.
 */
export const companySettingsValueSchema = z.object({
  companyName: nonEmptyString,
  gstNumber: z.string().trim().default(''),
  pan: z.string().trim().default(''),
  email: z
    .string()
    .trim()
    .default('')
    .refine(
      (value) => value.length === 0 || z.string().email().safeParse(value).success,
      'Enter a valid email',
    ),
  phone: z.string().trim().default(''),
  /** Display label / filename only — Storage upload is out of scope for P0. */
  logo: z.string().trim().default(''),
  address: z.string().trim().default(''),
});

export type CompanySettingsValue = z.infer<typeof companySettingsValueSchema>;

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function pickString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

/**
 * Map legacy / mixed keys into canonical field names without applying defaults.
 * Used by both read (with fallback name) and write (strict validation).
 */
export function normalizeCompanySettingsInput(
  raw: unknown,
): Record<string, string> {
  const obj = asRecord(raw);
  return {
    companyName: pickString(obj, ['companyName', 'name']),
    gstNumber: pickString(obj, ['gstNumber']),
    pan: pickString(obj, ['pan']),
    email: pickString(obj, ['email']),
    phone: pickString(obj, ['phone', 'phoneLabel']),
    logo: pickString(obj, ['logo', 'logoLabel']),
    address: pickString(obj, ['address', 'businessAddress']),
  };
}

/**
 * Normalize legacy / mixed company JSON into the canonical contract for reads.
 * Missing/blank companyName defaults to GroAurum for display/invoice fallbacks.
 */
export function parseCompanySettingsValue(
  raw: unknown,
): CompanySettingsValue {
  const normalized = normalizeCompanySettingsInput(raw);
  const companyName = normalized.companyName.trim() || 'GroAurum';
  return companySettingsValueSchema.parse({
    ...normalized,
    companyName,
  });
}

/**
 * Validate a write payload after legacy-key normalization.
 * Blank companyName is rejected (does not silently become GroAurum).
 */
export function parseCompanySettingsWriteValue(
  raw: unknown,
): CompanySettingsValue {
  return companySettingsValueSchema.parse(normalizeCompanySettingsInput(raw));
}

/** Serialize a validated company profile for settings.setting_value writes. */
export function toCompanySettingsJson(
  value: CompanySettingsValue,
): CompanySettingsValue {
  return companySettingsValueSchema.parse(value);
}

export const companySettingUpsertSchema = z.object({
  settingKey: z.literal(COMPANY_SETTING_KEY),
  settingValue: companySettingsValueSchema,
  description: z.string().optional(),
  updatedByProfileId: z.string().uuid().optional().nullable(),
});

export type CompanySettingUpsertInput = z.infer<
  typeof companySettingUpsertSchema
>;
