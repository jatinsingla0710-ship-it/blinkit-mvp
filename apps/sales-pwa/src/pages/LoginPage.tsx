import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthSession } from '@groaurum/auth/react';
import { Button, Card, PageHeader, TextField } from '@groaurum/ui';
import { readDevLoginPrefill } from '@/lib/operationalEnv';

export function LoginPage() {
  const navigate = useNavigate();
  const { status, isAuthenticated, signIn } = useAuthSession();
  const devPrefill = readDevLoginPrefill();
  const [email, setEmail] = useState(devPrefill.email);
  const [password, setPassword] = useState(devPrefill.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return (
      <div className="ga-sales-login">
        <PageHeader title="GroAurum Sales" subtitle="Loading session…" />
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
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ga-sales-login">
      <PageHeader
        title="GroAurum Sales"
        subtitle="Sign in to manage retailers, visits, and assisted orders"
      />
      <Card>
        <form className="ga-sales-form" onSubmit={onSubmit}>
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
          {error ? <p className="ga-sales-error">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
