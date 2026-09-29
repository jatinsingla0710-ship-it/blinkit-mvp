import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthSession } from '@groaurum/auth/react';
import { PageHeader } from '@groaurum/ui';
import { EMAIL_CODE_RESEND_MS, resendWaitSeconds } from '@/data/email-login';
import { readDevLoginPrefill, publicOperationalEnv } from '@/lib/operationalEnv';
import { LoginPanel, type LoginStep } from './LoginPanel';

function authFailure(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { status, isAuthenticated, signIn, requestEmailCode, verifyEmailCode } = useAuthSession();
  const devPrefill = readDevLoginPrefill();
  const demoCodeHint =
    publicOperationalEnv().VITE_AUTH_PROVIDER === 'mock'
      ? 'Demo code is 123456.'
      : null;
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState(devPrefill.email);
  const [password, setPassword] = useState(devPrefill.password);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  if (status === 'loading') {
    return (
      <div className="ga-sales-login">
        <PageHeader title="Sign in" subtitle="Loading session…" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      await requestEmailCode(email);
      setStep('code');
      setResendAt(Date.now() + EMAIL_CODE_RESEND_MS);
      setNow(Date.now());
    } catch (err) {
      setError(authFailure(err, 'Could not send the code. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === 'email') {
      await sendCode();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (step === 'code') {
        await verifyEmailCode(email, code);
      } else {
        await signIn({ email, password });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        authFailure(
          err,
          step === 'code' ? 'Could not verify the code. Try again.' : 'Sign-in failed. Try again.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (busy || resendWaitSeconds(Date.now(), resendAt) > 0) return;
    await sendCode();
  }

  return (
    <LoginPanel
      step={step}
      email={email}
      code={code}
      password={password}
      error={error}
      busy={busy}
      resendSeconds={step === 'code' ? resendWaitSeconds(now, resendAt) : 0}
      demoCodeHint={step === 'code' ? demoCodeHint : null}
      onEmail={setEmail}
      onCode={setCode}
      onPassword={setPassword}
      onSubmit={(event) => void onSubmit(event)}
      onResend={() => void onResend()}
      onUsePassword={() => {
        setError(null);
        setStep('password');
      }}
      onUseEmailCode={() => {
        setError(null);
        setStep('email');
      }}
    />
  );
}
