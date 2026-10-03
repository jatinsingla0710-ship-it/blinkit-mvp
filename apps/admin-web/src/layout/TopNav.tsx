import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentUser, useAuthSession } from '@groaurum/auth/react';
import type { NavGroup } from '@/data/dashboard-types';
import { AdminCommandSearch } from './AdminCommandSearch';
import './TopNav.css';

type Props = {
  groups: NavGroup[];
  onMenuClick?: () => void;
};

function roleLabel(role: string | undefined): string {
  if (!role) return 'Admin';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function TopNav({ groups, onMenuClick }: Props) {
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
            R
          </span>
          <span className="ga-topnav__name">RichlyBook</span>
          <span className="ga-topnav__product">Owner</span>
        </Link>
      </div>

      <div className="ga-topnav__right">
        <AdminCommandSearch groups={groups} />
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
