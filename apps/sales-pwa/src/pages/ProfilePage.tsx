import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button, Card, Field, FieldGrid } from '@groaurum/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { ChevronRightIcon, SignOutIcon, WalletIcon } from '@/components/icons';
import { isSalesDataMockMode } from '@/data/salesmanApi';
import { errorMessage } from '@/lib/errors';

export function ProfilePage() {
  const user = useCurrentUser();
  const { signOut } = useAuthSession();
  const navigate = useNavigate();
  const toast = useToast();
  const mockMode = isSalesDataMockMode();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign out. Check your signal and try again.'));
      setSigningOut(false);
    }
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Profile" subtitle={mockMode ? 'Demo account' : undefined} />

      <Card title="My details">
        <FieldGrid columns={2}>
          <Field label="Name">{user?.displayName ?? '—'}</Field>
          <Field label="Email">{user?.email ?? '—'}</Field>
          <Field label="Mobile">{user?.phone ?? '—'}</Field>
          <Field label="Role">Salesman</Field>
        </FieldGrid>
      </Card>

      <nav className="ga-sales-menu" aria-label="Profile">
        <Link to="/profile/earnings" className="ga-sales-menu__item">
          <WalletIcon />
          <span className="ga-sales-menu__label">
            My Earnings
            <span className="ga-sales-menu__hint">This month&apos;s orders and revenue</span>
          </span>
          <ChevronRightIcon size={20} />
        </Link>
      </nav>

      <Button
        variant="secondary"
        type="button"
        className="ga-sales-btn-block ga-sales-signout"
        disabled={signingOut}
        onClick={() => {
          void onSignOut();
        }}
      >
        <SignOutIcon size={22} />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
