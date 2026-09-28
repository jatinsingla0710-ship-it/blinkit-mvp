import { buildWhatsappShareUrl } from '@groaurum/shared-types';

export function telHref(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `tel:+${digits}`;
  return `tel:+${digits}`;
}

/** Contact WhatsApp. Opens from the link itself; does not depend on the customer-app URL. */
export function shopWhatsappHref(mobile: string, contactName: string): string {
  const name = contactName.trim() || 'there';
  return buildWhatsappShareUrl(mobile, `Hello ${name},`);
}

export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
