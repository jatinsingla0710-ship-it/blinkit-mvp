import { useState } from 'react';

/** 56px product image; falls back to the first letter when missing or broken. */
export function ProductThumb({ src, name }: { src: string | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="ga-sales-thumb ga-sales-thumb--empty" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className="ga-sales-thumb"
      src={src}
      alt=""
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
