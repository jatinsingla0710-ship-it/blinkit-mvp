import { describe, expect, it } from 'vitest';
import { SALES_SECTION_LINKS } from './section-links';

describe('Phase 16 payment proof UX wiring', () => {
  it('exposes payment proof link in sales section', () => {
    expect(SALES_SECTION_LINKS.some((l) => l.to === '/payments/scan')).toBe(
      true,
    );
  });
});
