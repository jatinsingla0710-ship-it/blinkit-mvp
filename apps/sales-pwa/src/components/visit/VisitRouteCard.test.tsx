import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesmanVisit } from '@groaurum/api-client';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';
import { VisitRouteCard } from './VisitRouteCard';

function visit(overrides: Partial<SalesmanVisit> = {}): SalesmanVisit {
  return {
    id: 'visit-1',
    shopId: 'shop-1',
    shopName: 'Sharma Stores',
    areaLabel: 'North',
    plannedAt: '2026-09-28T09:00:00.000Z',
    plannedAtLabel: '28 Sept, 2:30 pm',
    status: 'PLANNED',
    notes: 'Bring samples',
    contactName: 'Ravi',
    contactMobile: '9876543210',
    deliveryLat: 28.6139,
    deliveryLng: 77.209,
    checkInAt: null,
    checkInDistanceMetres: null,
    gpsVerification: null,
    ...overrides,
  };
}

function render(overrides: Partial<SalesmanVisit> = {}, props: Partial<Parameters<typeof VisitRouteCard>[0]> = {}) {
  return renderToStaticMarkup(
    <VisitRouteCard
      visit={visit(overrides)}
      notes="Bring samples"
      outcome={null}
      photoName={null}
      busy={false}
      error={null}
      onNotes={() => undefined}
      onOutcome={() => undefined}
      onPhoto={() => undefined}
      onCheckIn={() => undefined}
      onComplete={() => undefined}
      {...props}
    />,
  );
}

describe('visit route card', () => {
  it('shows the shop, planned time, status, mobile, and maps link', () => {
    const html = render();
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('28 Sept, 2:30 pm');
    expect(html).toContain('Planned');
    expect(html).toContain('9876543210');
    expect(linkHref(html, 'Open in Maps')).toContain('destination=28.6139,77.209');
    expect(html).toContain('Check In');
  });

  it('does not open maps when the shop location is missing', () => {
    const html = render({ deliveryLat: null, deliveryLng: null });
    expect(html).toContain('Shop location is not saved');
    expect(isButtonDisabled(html, 'Open in Maps')).toBe(true);
    expect(linkHref(html, 'Open in Maps')).toBeNull();
  });

  it('shows the server distance after check-in', () => {
    const html = render({
      checkInAt: '2026-09-28T09:05:00.000Z',
      checkInDistanceMetres: 42,
      gpsVerification: 'verified',
    });
    expect(html).toContain('You are approximately 42 m from this shop');
    expect(html).toContain('Visited');
    expect(html).toContain('Shop Closed');
    expect(html).toContain('Complete Visit');
  });

  it('does not invent a distance when shop GPS is unavailable', () => {
    const html = render({
      deliveryLat: null,
      deliveryLng: null,
      checkInAt: '2026-09-28T09:05:00.000Z',
      checkInDistanceMetres: null,
      gpsVerification: 'unavailable',
    });
    expect(html).toContain('GPS verification is unavailable');
    expect(html).not.toContain('approximately');
  });

  it('disables Check In while the check-in is running', () => {
    const html = render({}, { busy: true });
    expect(html).toContain('Checking in…');
    expect(isButtonDisabled(html, 'Checking in…')).toBe(true);
  });

  it('disables Complete Visit until an outcome is chosen, and while it is running', () => {
    const checkedIn = {
      checkInAt: '2026-09-28T09:05:00.000Z',
      checkInDistanceMetres: 10,
    };
    expect(isButtonDisabled(render(checkedIn), 'Complete Visit')).toBe(true);
    const chosen = render(checkedIn, { outcome: 'VISITED' });
    expect(isButtonDisabled(chosen, 'Complete Visit')).toBe(false);
    const running = render(checkedIn, { outcome: 'SHOP_CLOSED', busy: true });
    expect(htmlBusy(running)).toBe(true);
  });

  it('shows a photo upload failure without clearing the visit', () => {
    const html = render(
      { checkInAt: '2026-09-28T09:05:00.000Z', checkInDistanceMetres: 10, notes: 'Bring samples' },
      { error: 'Could not upload the photo', photoName: 'shop.jpg' },
    );
    expect(html).toContain('Could not upload the photo');
    expect(html).toContain('Bring samples');
    expect(html).toContain('shop.jpg');
  });
});

function htmlBusy(html: string): boolean {
  return isButtonDisabled(html, 'Completing…');
}
