import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createDataError } from '@groaurum/data';
import { formatMutationError } from './mutation-errors';

describe('formatMutationError', () => {
  it('surfaces DataError messages instead of a generic failure', () => {
    expect(
      formatMutationError(
        createDataError('unexpected', 'PIN code is not serviceable'),
        'Create failed',
      ),
    ).toBe('PIN code is not serviceable');
  });

  it('keeps Zod issues readable', () => {
    const error = ZodError.create([
      {
        code: 'custom',
        message: 'Shop name is required',
        path: ['tradeName'],
      },
    ]);
    expect(formatMutationError(error)).toBe('Shop name is required');
  });
});
