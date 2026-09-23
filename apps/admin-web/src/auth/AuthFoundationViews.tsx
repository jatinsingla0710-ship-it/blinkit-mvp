import { useAuthSession } from '@groaurum/auth/react';
import { Card, PageHeader } from '@groaurum/ui';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import './AuthFoundationViews.css';

function Shell({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="ga-auth-foundation">
      <PageHeader title={title} subtitle="Authentication" />
      <Card>
        <p className="ga-auth-foundation__detail">{detail}</p>
      </Card>
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="ga-auth-foundation ga-auth-foundation--shell">
      <PageSkeleton title="Restoring session" blocks={2} />
    </div>
  );
}

function Unauthorized() {
  return (
    <Shell
      title="Unauthorized"
      detail="Sign-in is required. Redirecting to the login page…"
    />
  );
}

function Forbidden({ module }: { module?: string }) {
  return (
    <Shell
      title="Forbidden"
      detail={
        module
          ? `Your role cannot access the ${module.replace('_', ' ')} module.`
          : 'Your role cannot access this area.'
      }
    />
  );
}

function WrongAudience() {
  const { session } = useAuthSession();
  const audience = session?.audience ?? 'unknown';
  return (
    <Shell
      title="Wrong application"
      detail={`This account belongs on ${audience.replace('_', ' ')}. Open the correct GroAurum client.`}
    />
  );
}

function ErrorView() {
  const { error } = useAuthSession();
  return (
    <Shell
      title={error?.code === 'session_expired' ? 'Session expired' : 'Auth error'}
      detail={
        error?.message ??
        'Unexpected authentication error. Sign in again or check your connection.'
      }
    />
  );
}

/** Auth foundation views used by route guards. */
export const AuthFoundationViews = {
  SessionLoading,
  Unauthorized,
  Forbidden,
  WrongAudience,
  Error: ErrorView,
};
