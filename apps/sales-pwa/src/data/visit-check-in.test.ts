import { describe, expect, it } from 'vitest';
import { GeoReadError } from '@/data/geolocation';
import {
  createActionLock,
  formatDistanceMetres,
  sortVisitsByPlannedTime,
  visitCheckInFailureMessage,
} from './visit-check-in';

describe('visit route and GPS helpers', () => {
  it('sorts visits by planned time', () => {
    const sorted = sortVisitsByPlannedTime([
      { id: 'b', plannedAt: '2026-09-28T11:00:00.000Z' },
      { id: 'a', plannedAt: '2026-09-28T09:00:00.000Z' },
    ]);
    expect(sorted.map((visit) => visit.id)).toEqual(['a', 'b']);
  });

  it('formats a real distance and does not invent one', () => {
    expect(formatDistanceMetres(41.6)).toBe('You are approximately 42 m from this shop');
    expect(formatDistanceMetres(null)).toBeNull();
    expect(formatDistanceMetres(undefined)).toBeNull();
  });

  it('turns a denied location into a failed check-in message', () => {
    expect(
      visitCheckInFailureMessage(
        new GeoReadError('denied', 'Location permission was denied.'),
      ),
    ).toBe('Location permission is required to verify this visit.');
  });

  it('turns a timeout into a retry message', () => {
    expect(visitCheckInFailureMessage(new GeoReadError('timeout', 'timed out'))).toBe(
      'Location request timed out. Try again.',
    );
  });

  it('ignores a second tap while the first action is held', () => {
    const lock = createActionLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });
});
