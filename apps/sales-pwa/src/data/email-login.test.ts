import { describe, expect, it } from 'vitest';
import { emailCodeErrorMessage } from '@groaurum/auth/supabase';
import { resendWaitSeconds } from './email-login';
import { profileNameError } from './profile';

describe('sales login copy', () => {
  it('does not ask the salesman for an invitation', () => {
    expect(emailCodeErrorMessage('User not found', 'send')).toBe(
      'No account was found for this email. Ask your admin to add your account, or use your password.',
    );
    expect(emailCodeErrorMessage('User not found', 'send')).not.toMatch(/invite/i);
  });
});

describe('email code resend', () => {
  it('blocks a second send until the wait elapses', () => {
    const now = 1_000_000;
    expect(resendWaitSeconds(now, now + 20_000)).toBe(20);
    expect(resendWaitSeconds(now + 20_000, now + 20_000)).toBe(0);
  });
});

describe('profile name', () => {
  it('requires a name and rejects a blank clear', () => {
    expect(profileNameError('  Asha  ')).toBeNull();
    expect(profileNameError('   ')).toMatch(/name/i);
  });
});
