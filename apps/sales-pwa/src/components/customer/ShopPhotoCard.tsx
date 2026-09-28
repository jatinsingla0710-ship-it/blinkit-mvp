import type { ChangeEvent } from 'react';

type Props = {
  url: string | null;
  uploading: boolean;
  error: string | null;
  onFile: (file: File) => void;
};

export function ShopPhotoCard({ url, uploading, error, onFile }: Props) {
  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFile(file);
  }

  return (
    <div className="ga-sales-photo">
      {url ? (
        <img className="ga-sales-photo__img" src={url} alt="Shop photo" />
      ) : (
        <p className="ga-sales-muted">No shop photo yet. A photo is optional.</p>
      )}
      <label className="ga-btn ga-btn--secondary ga-sales-file-label">
        {uploading ? 'Uploading photo…' : url ? 'Replace photo' : 'Add photo'}
        <input
          className="ga-sales-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={onChange}
        />
      </label>
      {error ? (
        <p className="ga-sales-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
