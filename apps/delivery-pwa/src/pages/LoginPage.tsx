import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { parsePublicAuthConfig } from '@groaurum/auth';
import { useAuthSession } from '@groaurum/auth/react';
import { Button, Card, PageHeader, TextField } from '@groaurum/ui';
import {
  publicOperationalEnv,
  readDevLoginPrefill,
} from '@/lib/operationalEnv';

function authErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  if (err instanceof Error) return err.message;
  return 'Sign-in failed.';
}

const authConfig = parsePublicAuthConfig(
  publicOperationalEnv(),
);

export function LoginPage() {
  const navigate = useNavigate();
  const { status, isAuthenticated, signIn, error: sessionError } =
    useAuthSession();
  const devPrefill = readDevLoginPrefill();
  const [email, setEmail] = useState(devPrefill.email);
  const [password, setPassword] = useState(devPrefill.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authConfig.authProvider === 'mock') {
    return <Navigate to="/" replace />;
  }

  if (status === 'loading') {
    return (
      <div className="ga-delivery-login">
        <PageHeader title="GroAurum Delivery" subtitle="Loading session…" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ga-delivery-login">
      <PageHeader
        title="GroAurum Delivery"
        subtitle="Sign in to run routes, stops, and COD collections"
      />
      <Card>
        <form className="ga-delivery-form" onSubmit={onSubmit}>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            grow
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            grow
          />
          {error || sessionError?.message ? (
            <p className="ga-delivery-error" role="alert">
              {error || sessionError?.message}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
