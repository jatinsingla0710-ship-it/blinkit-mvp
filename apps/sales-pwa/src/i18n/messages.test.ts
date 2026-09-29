import { describe, expect, it } from 'vitest';
import { salesMessageKeys, translate } from './messages';

describe('English and Hindi copy', () => {
  it('has a Hindi string for every English key', () => {
    for (const key of salesMessageKeys()) {
      expect(translate('en', key).length).toBeGreaterThan(0);
      expect(translate('hi', key).length).toBeGreaterThan(0);
      expect(translate('hi', key)).not.toBe(translate('en', key));
    }
  });

  it('keeps the English navigation labels', () => {
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('en', 'nav.orders')).toBe('Orders');
    expect(translate('en', 'nav.customers')).toBe('Customers');
    expect(translate('en', 'nav.profile')).toBe('Profile');
    expect(translate('hi', 'nav.home')).toBe('होम');
  });
});
