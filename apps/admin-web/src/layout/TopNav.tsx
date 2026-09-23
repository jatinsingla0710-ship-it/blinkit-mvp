import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser, useAuthSession } from '@groaurum/auth/react';
import { Button } from '@/components/ui/Button';
import './TopNav.css';

type Props = {
  onMenuClick?: () => void;
  notificationCount?: number;
};

function roleLabel(role: string | undefined): string {
  if (!role) return 'Admin';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function TopNav({ onMenuClick, notificationCount = 0 }: Props) {
  const user = useCurrentUser();
  const { signOut } = useAuthSession();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileName = user?.displayName || user?.email || 'User';
  const profileRole = roleLabel(user?.primaryRole);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  };

  return (
    <header className="ga-topnav">
      <div className="ga-topnav__left">
        <button
          type="button"
          className="ga-topnav__menu"
          aria-label="Toggle navigation"
          onClick={onMenuClick}
        >
          Menu
        </button>
        <Link to="/" className="ga-topnav__brand">
          <span className="ga-topnav__mark" aria-hidden>
            G
          </span>
          <span className="ga-topnav__name">GroAurum</span>
          <span className="ga-topnav__product">Admin</span>
        </Link>
      </div>

      <div className="ga-topnav__right">
        <Button
          variant="ghost"
          className="ga-topnav__notify"
          aria-label="Notifications"
          type="button"
        >
          Alerts
          {notificationCount > 0 ? (
            <span className="ga-topnav__notify-count">{notificationCount}</span>
          ) : null}
        </Button>

        <div className="ga-topnav__user">
          <button
            type="button"
            className="ga-topnav__profile"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
            title={`${profileName} · ${profileRole}`}
          >
            <span className="ga-topnav__avatar" aria-hidden>
              {profileName.slice(0, 1).toUpperCase()}
            </span>
            <span className="ga-topnav__profile-text">
              <span className="ga-topnav__profile-name">{profileName}</span>
              <span className="ga-topnav__profile-role">{profileRole}</span>
            </span>
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="ga-topnav__menu-backdrop"
                aria-label="Close user menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="ga-topnav__dropdown" role="menu">
                <div className="ga-topnav__dropdown-meta">
                  <strong>{profileName}</strong>
                  <span>{user?.email ?? profileRole}</span>
                </div>
                <button
                  type="button"
                  className="ga-topnav__dropdown-item"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => void onLogout()}
                >
                  {signingOut ? 'Signing out…' : 'Log out'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
