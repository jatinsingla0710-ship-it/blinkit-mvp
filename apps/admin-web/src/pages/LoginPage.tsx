import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { parsePublicAuthConfig } from '@groaurum/auth';
import { useAuthSession } from '@groaurum/auth/react';
import { Button, TextField } from '@groaurum/ui';
import {
  publicOperationalEnv,
  readDevLoginPrefill,
} from '@/lib/operationalEnv';
import './LoginPage.css';

type LocationState = {
  from?: string;
  authError?: string;
};

function authErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  if (err instanceof Error) return err.message;
  return 'Sign-in failed. Check your email and password.';
}

const authConfig = parsePublicAuthConfig(
  publicOperationalEnv(),
);

/**
 * Dedicated Admin login — email + password via Supabase Auth.
 * Restored sessions skip this page; unauthenticated users are redirected here.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;
  const { status, isAuthenticated, signIn, error: sessionError } =
    useAuthSession();

  const devPrefill = readDevLoginPrefill();
  const [email, setEmail] = useState(devPrefill.email);
  const [password, setPassword] = useState(devPrefill.password);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    () => state?.authError ?? null,
  );

  if (authConfig.authProvider === 'mock') {
    return <Navigate to={state?.from || '/'} replace />;
  }

  if (status === 'loading') {
    return (
      <div className="ga-login">
        <div className="ga-login__card" aria-busy="true">
          <div className="ga-login__brand">
            <span className="ga-login__mark" aria-hidden>
              R
            </span>
            <div>
              <p className="ga-login__title">RichlyBook</p>
              <p className="ga-login__subtitle">Restoring session…</p>
            </div>
          </div>
          <div className="ga-skeleton ga-skeleton--line" />
          <div className="ga-skeleton ga-skeleton--line" />
          <div className="ga-skeleton ga-skeleton--button" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={state?.from || '/'} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn({ email: trimmedEmail, password });
      navigate(state?.from || '/', { replace: true });
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const bannerError = formError || sessionError?.message || null;

  return (
    <div className="ga-login">
      <div className="ga-login__card">
        <div className="ga-login__brand">
          <span className="ga-login__mark" aria-hidden>
            R
          </span>
          <div>
            <p className="ga-login__title">RichlyBook</p>
            <p className="ga-login__subtitle">Your business, clearly managed</p>
          </div>
        </div>

        <form className="ga-login__form" onSubmit={onSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {bannerError ? (
            <p className="ga-login__error" role="alert">
              {bannerError}
            </p>
          ) : null}

          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
            className="ga-login__submit"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
