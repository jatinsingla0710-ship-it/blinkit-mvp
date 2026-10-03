import { describe, expect, it } from 'vitest';
import { ACCOUNTING_SECTION_LINKS } from './section-links';

describe('Phase 15 day book scan UX wiring', () => {
  it('exposes enter daily book link in accounting section', () => {
    expect(
      ACCOUNTING_SECTION_LINKS.some((l) => l.to === '/day-book/scan'),
    ).toBe(true);
  });
});
