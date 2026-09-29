export const SALES_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
] as const;

export type SalesLanguageCode = (typeof SALES_LANGUAGES)[number]['code'];

export function languageLabel(code: string): string {
  return SALES_LANGUAGES.find((item) => item.code === code)?.label ?? 'English';
}

export function profileNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter your name.';
  if (trimmed.length > 80) return 'Name must be 80 characters or fewer.';
  return null;
}
