import { describe, expect, it } from 'vitest';
import { ACCOUNTING_SECTION_LINKS } from './section-links';

describe('Phase 14 receipt scan UX wiring', () => {
  it('exposes receipt photo link in accounting section', () => {
    expect(
      ACCOUNTING_SECTION_LINKS.some((l) => l.to === '/expenses/scan'),
    ).toBe(true);
  });
});
