import type { FormEvent } from 'react';
import { Button, PageHeader, TextField } from '@groaurum/ui';

export type LoginStep = 'email' | 'code' | 'password';

type Props = {
  step: LoginStep;
  email: string;
  code: string;
  password: string;
  error: string | null;
  busy: boolean;
  resendSeconds: number;
  demoCodeHint: string | null;
  onEmail: (value: string) => void;
  onCode: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onResend: () => void;
  onUsePassword: () => void;
  onUseEmailCode: () => void;
};

export function LoginPanel({
  step,
  email,
  code,
  password,
  error,
  busy,
  resendSeconds,
  demoCodeHint,
  onEmail,
  onCode,
  onPassword,
  onSubmit,
  onResend,
  onUsePassword,
  onUseEmailCode,
}: Props) {
  const title = step === 'password' ? 'Sign in with password' : 'Sign in';
  const subtitle =
    step === 'code'
      ? 'Enter the 6-digit code sent to your email. You stay signed in on this phone.'
      : 'Use your company email. You stay signed in on this phone.';

  return (
    <div className="ga-sales-login">
      <img className="ga-sales-login__logo" src="/icons/icon-192.png" alt="Salesaurum" />
      <PageHeader title={title} subtitle={subtitle} />
      <form className="ga-sales-form" onSubmit={onSubmit}>
        <TextField
          label="Company email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={step === 'email' ? 'send' : 'next'}
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          required
          grow
          disabled={busy || step === 'code'}
        />
        {step === 'code' ? (
          <TextField
            label="6-digit code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            maxLength={6}
            value={code}
            onChange={(event) => onCode(event.target.value)}
            required
            grow
            disabled={busy}
          />
        ) : null}
        {step === 'password' ? (
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            enterKeyHint="go"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
            required
            grow
            disabled={busy}
          />
        ) : null}
        {demoCodeHint ? <p className="ga-sales-muted">{demoCodeHint}</p> : null}
        {error ? (
          <p className="ga-sales-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy
            ? step === 'email'
              ? 'Sending code…'
              : 'Signing in…'
            : step === 'email'
              ? 'Send code'
              : step === 'code'
                ? 'Verify code'
                : 'Sign in'}
        </Button>
        {step === 'code' ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || resendSeconds > 0}
            onClick={onResend}
          >
            {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
          </Button>
        ) : null}
        {step === 'password' ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={onUseEmailCode}>
            Use email code
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled={busy} onClick={onUsePassword}>
            Use password instead
          </Button>
        )}
      </form>
    </div>
  );
}
