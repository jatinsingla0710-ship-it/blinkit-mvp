import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button, SelectField, TextField } from '@groaurum/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { shopPhotoFileError } from '@/data/customer-form';
import { SALES_LANGUAGES, profileNameError, type SalesLanguageCode } from '@/data/profile';
import { errorMessage } from '@/lib/errors';

export function ProfileSetupPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const { signOut, refreshSession } = useAuthSession();
  const navigate = useNavigate();
  const toast = useToast();
  const profileId = user?.id ?? '';
  const profile = useQuery({
    queryKey: ['sales', 'profile', profileId],
    queryFn: () => api.getOwnProfile(),
    enabled: Boolean(profileId),
  });
  const [name, setName] = useState<string | null>(null);
  const [language, setLanguage] = useState<SalesLanguageCode | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const displayName = name ?? profile.data?.displayName ?? '';
  const preferredLanguage = language ?? profile.data?.preferredLanguage ?? 'en';

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!next) return;
    const problem = shopPhotoFileError(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(next);
    setPhotoName(next.name);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nameError = profileNameError(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let avatarPath: string | null = null;
      if (file) {
        const uploaded = await api.uploadProfilePhoto({
          bytes: await file.arrayBuffer(),
          contentType: file.type,
        });
        avatarPath = uploaded.path;
      }
      await api.updateOwnProfile({
        displayName,
        preferredLanguage,
        updateAvatar: Boolean(file),
        avatarPath,
        completeSetup: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['sales', 'profile', profileId] });
      await refreshSession();
      toast.success('Profile saved');
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="Set up your profile"
        subtitle="Name and language. A photo is optional."
      />
      {profile.isLoading ? <LoadingState label="Loading your profile…" rows={2} /> : null}
      {profile.isError ? (
        <ErrorState
          message={errorMessage(profile.error, 'Could not load your profile.')}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
      ) : null}
      {profile.data ? (
        <form className="ga-sales-form" onSubmit={(event) => void onSubmit(event)}>
          <TextField
            label="Name"
            name="name"
            value={displayName}
            onChange={(event) => setName(event.target.value)}
            required
            grow
            disabled={busy}
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
            {photoName ? 'Replace photo' : 'Add photo'}
            <input
              className="ga-sales-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={onPhoto}
            />
          </label>
          {photoName ? <p className="ga-sales-muted">{photoName}</p> : null}
          {error ? (
            <p className="ga-sales-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void onSignOut()}>
            Sign out
          </Button>
        </form>
      ) : null}
    </div>
  );
}
