import { describe, expect, it } from 'vitest';
import { createDataError } from '@groaurum/data';
import {
  validateCustomerCollectionAmount,
  validateOpeningBalanceForm,
} from './customer-account-forms';
import { formatMutationError } from './mutation-errors';

describe('validateCustomerCollectionAmount', () => {
  it('rejects non-positive amounts', () => {
    expect(validateCustomerCollectionAmount('', 1000, '₹1,000')).toEqual({
      ok: false,
      error: 'Enter an amount greater than zero.',
    });
    expect(validateCustomerCollectionAmount('0', 1000, '₹1,000')).toEqual({
      ok: false,
      error: 'Enter an amount greater than zero.',
    });
    expect(validateCustomerCollectionAmount('-5', 1000, '₹1,000')).toEqual({
      ok: false,
      error: 'Enter an amount greater than zero.',
    });
  });

  it('rejects amounts above outstanding', () => {
    expect(
      validateCustomerCollectionAmount('1000.01', 1000, '₹1,000'),
    ).toEqual({
      ok: false,
      error: 'Amount cannot be more than outstanding (₹1,000).',
    });
  });

  it('accepts amounts up to outstanding', () => {
    expect(validateCustomerCollectionAmount('1000', 1000, '₹1,000')).toEqual({
      ok: true,
      amount: 1000,
    });
    expect(validateCustomerCollectionAmount('250.5', 1000, '₹1,000')).toEqual({
      ok: true,
      amount: 250.5,
    });
  });
});

describe('validateOpeningBalanceForm', () => {
  it('rejects invalid amount and missing date', () => {
    expect(validateOpeningBalanceForm('0', '2026-04-01')).toEqual({
      ok: false,
      error: 'Enter an amount greater than zero.',
    });
    expect(validateOpeningBalanceForm('500', '')).toEqual({
      ok: false,
      error: 'Choose the as-of date.',
    });
  });

  it('accepts a valid opening balance', () => {
    expect(validateOpeningBalanceForm('20000', '2026-04-01')).toEqual({
      ok: true,
      amount: 20000,
    });
  });
});

describe('customer payment / opening RPC error surfacing', () => {
  it('shows adapter_unavailable and RPC messages clearly', () => {
    expect(
      formatMutationError(
        createDataError(
          'adapter_unavailable',
          'Live API requires VITE_DATA_ADAPTER=supabase.',
        ),
        'Could not receive payment',
      ),
    ).toBe('Live API requires VITE_DATA_ADAPTER=supabase.');

    expect(
      formatMutationError(
        new Error('Could not record customer collection'),
        'Could not receive payment',
      ),
    ).toBe('Could not record customer collection');

    expect(
      formatMutationError(
        new Error('Could not set opening balance'),
        'Could not save opening balance',
      ),
    ).toBe('Could not set opening balance');
  });
});
