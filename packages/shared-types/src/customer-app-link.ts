/**
 * Customer App link + WhatsApp share helpers (no env coupling).
 */

export function buildCustomerAppWhatsappMessage(input: {
  customerName: string;
  appUrl: string;
}): string {
  const name = input.customerName.trim() || 'there';
  const url = input.appUrl.replace(/\/$/, '');
  return [
    `Hello ${name},`,
    '',
    'You can manage your orders and account using the GroAurum Customer App.',
    '',
    `Open or download the app here:`,
    url,
    '',
    'Log in using your registered mobile number.',
  ].join('\n');
}

/** Normalize mobile for wa.me (digits only, with country code). */
export function normalizeWhatsappMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

export function buildWhatsappShareUrl(mobile: string, message: string): string {
  const phone = normalizeWhatsappMobile(mobile);
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}
