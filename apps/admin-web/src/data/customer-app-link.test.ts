import { describe, expect, it } from 'vitest';

import {
  buildCustomerAppWhatsappMessage,
  buildWhatsappShareUrl,
  normalizeWhatsappMobile,
} from '@groaurum/shared-types';

describe('customer app link helpers', () => {
  it('builds a friendly WhatsApp message without activation tokens', () => {
    const message = buildCustomerAppWhatsappMessage({
      customerName: 'Ramesh Sharma',
      appUrl: 'https://app.groaurum.com/',
    });
    expect(message).toContain('Ramesh Sharma');
    expect(message).toContain('https://app.groaurum.com');
    expect(message).toMatch(/registered mobile number/i);
    expect(message).not.toMatch(/token/i);
  });

  it('normalizes Indian mobile numbers for wa.me', () => {
    expect(normalizeWhatsappMobile('9876543210')).toBe('919876543210');
    expect(normalizeWhatsappMobile('+91 98765 43210')).toBe('919876543210');
  });

  it('builds WhatsApp share URL', () => {
    const url = buildWhatsappShareUrl(
      '+919876543210',
      'Hello from GroAurum',
    );
    expect(url).toContain('https://wa.me/919876543210');
    expect(url).toContain('text=');
  });
});
