import { describe, expect, it } from 'vitest';
import { PURCHASING_SECTION_LINKS } from './purchasing';

describe('Phase 13 bill scan UX wiring', () => {
  it('exposes bill photo link in purchasing section', () => {
    expect(PURCHASING_SECTION_LINKS.some((l) => l.to === '/purchases/scan')).toBe(
      true,
    );
  });
});
