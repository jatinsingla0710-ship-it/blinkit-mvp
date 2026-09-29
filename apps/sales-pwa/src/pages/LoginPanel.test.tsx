import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isButtonDisabled } from '@/test-utils/markup';
import { LoginPanel } from './LoginPanel';

function render(overrides: Partial<Parameters<typeof LoginPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <LoginPanel
      step="email"
      email="asha@example.com"
      code=""
      password=""
      error={null}
      busy={false}
      resendSeconds={0}
      demoCodeHint={null}
      onEmail={() => undefined}
      onCode={() => undefined}
      onPassword={() => undefined}
      onSubmit={(event) => event.preventDefault()}
      onResend={() => undefined}
      onUsePassword={() => undefined}
      onUseEmailCode={() => undefined}
      {...overrides}
    />,
  );
}

describe('email login panel', () => {
  it('asks for a company email and keeps a password fallback', () => {
    const html = render();
    expect(html).toContain('Company email');
    expect(html).toContain('Send code');
    expect(html).toContain('Use password instead');
    expect(html).toContain('stay signed in');
    expect(html).not.toContain('GroAurum');
    expect(html).toContain('Salesaurum');
    expect(html).toContain('/icons/icon-192.png');
  });

  it('shows the code step, a resend wait, and a verify error', () => {
    const html = render({
      step: 'code',
      code: '123456',
      resendSeconds: 20,
      error: 'That code is not valid. Request a new code and try again.',
    });
    expect(html).toContain('6-digit code');
    expect(html).toContain('Verify code');
    expect(isButtonDisabled(html, 'Resend code in 20s')).toBe(true);
    expect(html).toContain('That code is not valid');
  });

  it('disables send while the code request is running', () => {
    const html = render({ busy: true });
    expect(html).toContain('Sending code…');
    expect(isButtonDisabled(html, 'Sending code…')).toBe(true);
    expect(isButtonDisabled(html, 'Use password instead')).toBe(true);
  });

  it('offers password sign-in without removing the email-code path', () => {
    const html = render({ step: 'password', password: 'secret' });
    expect(html).toContain('Password');
    expect(html).toContain('Use email code');
    expect(isButtonDisabled(html, 'Sign in')).toBe(false);
  });
});
