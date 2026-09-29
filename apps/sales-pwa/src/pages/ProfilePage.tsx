import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button, SelectField, TextField } from '@groaurum/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { BellIcon, ChevronRightIcon, MessageIcon, OrdersIcon, SignOutIcon, WalletIcon } from '@/components/icons';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { shopPhotoFileError } from '@/data/customer-form';
import { SALES_LANGUAGES, languageLabel, profileNameError, type SalesLanguageCode } from '@/data/profile';
import { useT } from '@/i18n/language';
import { SALES_APP_VERSION } from '@/lib/app-version';
import { errorMessage } from '@/lib/errors';

export function ProfilePage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const { signOut, refreshSession } = useAuthSession();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const profileId = user?.id ?? '';
  const profile = useQuery({
    queryKey: ['sales', 'profile', profileId],
    queryFn: () => api.getOwnProfile(),
    enabled: Boolean(profileId),
  });
  const [name, setName] = useState<string | null>(null);
  const [language, setLanguage] = useState<SalesLanguageCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const data = profile.data;
  const displayName = name ?? data?.displayName ?? user?.displayName ?? '';
  const preferredLanguage = language ?? data?.preferredLanguage ?? 'en';

  async function save(next: { updateAvatar?: boolean; avatarPath?: string | null }) {
    const nameError = profileNameError(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateOwnProfile({
        displayName,
        preferredLanguage,
        updateAvatar: next.updateAvatar ?? false,
        avatarPath: next.avatarPath,
      });
      await queryClient.invalidateQueries({ queryKey: ['sales', 'profile', profileId] });
      await refreshSession();
      setName(null);
      setLanguage(null);
      toast.success('Profile saved');
    } catch (err) {
      const message = errorMessage(err, 'Could not save your profile. Try again.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    const problem = shopPhotoFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await api.uploadProfilePhoto({
        bytes: await file.arrayBuffer(),
        contentType: file.type,
      });
      await api.updateOwnProfile({
        displayName,
        preferredLanguage,
        updateAvatar: true,
        avatarPath: uploaded.path,
      });
      await queryClient.invalidateQueries({ queryKey: ['sales', 'profile', profileId] });
      toast.success('Photo saved');
    } catch (err) {
      const message = errorMessage(err, 'Could not upload the photo. Try again.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    if (signingOut) return;
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
      <ScreenHeader title="Profile" />
      {profile.isLoading ? <LoadingState label="Loading your profile…" rows={3} /> : null}
      {profile.isError ? (
        <ErrorState
          message={errorMessage(profile.error, 'Could not load your profile.')}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
      ) : null}
      {data ? (
        <>
          <div className="ga-sales-profile">
            {data.avatarUrl ? (
              <img className="ga-sales-profile__photo" src={data.avatarUrl} alt="" />
            ) : (
              <div className="ga-sales-profile__photo ga-sales-profile__photo--empty" aria-hidden>
                {displayName.slice(0, 1).toUpperCase() || 'S'}
              </div>
            )}
            <div>
              <p className="ga-sales-profile__name">{data.displayName}</p>
              <p className="ga-sales-profile__meta">{data.email ?? user?.email ?? '—'}</p>
              <p className="ga-sales-profile__meta">{languageLabel(data.preferredLanguage)}</p>
            </div>
          </div>
          <form
            className="ga-sales-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save({});
            }}
          >
            <TextField
              label="Name"
              name="name"
              value={displayName}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              grow
            />
            <SelectField
              label="Preferred language"
              name="language"
              value={preferredLanguage}
              disabled={busy}
              onChange={(value) => setLanguage(value === 'hi' ? 'hi' : 'en')}
            >
              {SALES_LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <label className="ga-btn ga-btn--secondary ga-sales-file-label">
              {data.avatarUrl ? 'Replace photo' : 'Add photo'}
              <input
                className="ga-sales-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => void onPhoto(event)}
              />
            </label>
            {error ? (
              <p className="ga-sales-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </>
      ) : null}

      <nav className="ga-sales-menu" aria-label="Profile">
        <Link to="/profile/earnings" className="ga-sales-menu__item">
          <WalletIcon />
          <span className="ga-sales-menu__label">{t('profile.earnings')}</span>
          <ChevronRightIcon size={20} />
        </Link>
        <Link to="/profile/expenses" className="ga-sales-menu__item">
          <WalletIcon />
          <span className="ga-sales-menu__label">{t('profile.expenses')}</span>
          <ChevronRightIcon size={20} />
        </Link>
        <Link to="/profile/returns" className="ga-sales-menu__item">
          <OrdersIcon />
          <span className="ga-sales-menu__label">{t('profile.returns')}</span>
          <ChevronRightIcon size={20} />
        </Link>
        <Link to="/profile/messages" className="ga-sales-menu__item">
          <MessageIcon />
          <span className="ga-sales-menu__label">{t('profile.messages')}</span>
          <ChevronRightIcon size={20} />
        </Link>
        <Link to="/profile/notices" className="ga-sales-menu__item">
          <BellIcon />
          <span className="ga-sales-menu__label">{t('profile.notices')}</span>
          <ChevronRightIcon size={20} />
        </Link>
      </nav>

      <p className="ga-sales-muted">App version {SALES_APP_VERSION}</p>

      <Button
        variant="secondary"
        type="button"
        className="ga-sales-btn-block ga-sales-signout"
        disabled={signingOut || busy}
        onClick={() => void onSignOut()}
      >
        <SignOutIcon size={22} />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
