import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShopPhotoCard } from './ShopPhotoCard';

describe('shop photo card (Q, R)', () => {
  it('shows a saved photo and a replace action', () => {
    const html = renderToStaticMarkup(
      <ShopPhotoCard
        url="https://signed.example/shop"
        uploading={false}
        error={null}
        onFile={() => undefined}
      />,
    );
    expect(html).toContain('src="https://signed.example/shop"');
    expect(html).toContain('Replace photo');
    expect(html).not.toContain('Uploading photo…');
  });

  it('keeps the current photo visible when a later upload fails', () => {
    const html = renderToStaticMarkup(
      <ShopPhotoCard
        url="https://signed.example/shop"
        uploading={false}
        error="Could not upload the photo"
        onFile={() => undefined}
      />,
    );
    expect(html).toContain('src="https://signed.example/shop"');
    expect(html).toContain('Could not upload the photo');
    expect(html).toContain('role="alert"');
  });

  it('shows a loading state while uploading', () => {
    const html = renderToStaticMarkup(
      <ShopPhotoCard url={null} uploading error={null} onFile={() => undefined} />,
    );
    expect(html).toContain('Uploading photo…');
    expect(html).toContain('disabled');
  });
});
