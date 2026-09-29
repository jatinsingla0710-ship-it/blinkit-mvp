import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSalesmanService } from './salesman-api-mock';
import { resolveVisitNotesForUpdate } from './visit-notes';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveVisitNotesForUpdate (E)', () => {
  it('keeps stored notes when the salesman only changes status', () => {
    expect(resolveVisitNotesForUpdate(undefined, 'Owner asked for price list')).toBe(
      'Owner asked for price list',
    );
    expect(resolveVisitNotesForUpdate(undefined, null)).toBeNull();
  });

  it('uses edited notes, trimmed', () => {
    expect(resolveVisitNotesForUpdate('  Met owner  ', 'old')).toBe('Met owner');
  });

  it('clears notes only when the salesman empties the field', () => {
    expect(resolveVisitNotesForUpdate('   ', 'old')).toBeNull();
  });
});

describe('mock salesman API updateVisitStatus (E)', () => {
  it('leaves notes unchanged on a status-only update', async () => {
    const api = createMockSalesmanService();
    const [visit] = await api.listTodaysVisits('mock-profile');
    if (!visit) throw new Error('mock data has no visits');
    await api.updateVisitStatus(visit.id, 'VISITED', 'Stocked up on rice');
    await api.updateVisitStatus(visit.id, 'PENDING');
    const [after] = (await api.listTodaysVisits('mock-profile')).filter(
      (v) => v.id === visit.id,
    );
    expect(after.status).toBe('PENDING');
    expect(after.notes).toBe('Stocked up on rice');
  });
});
