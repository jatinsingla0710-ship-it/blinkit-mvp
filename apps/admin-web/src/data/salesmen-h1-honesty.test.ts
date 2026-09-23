import { describe, expect, it } from 'vitest';
import { SALESMAN_VISITS_EMPTY_DETAIL } from './salesmen-helpers';

describe('Salesman visits honesty copy', () => {
  it('names sales_visits and does not invent GPS/offline planner', () => {
    expect(SALESMAN_VISITS_EMPTY_DETAIL).toMatch(/sales_visits/i);
    expect(SALESMAN_VISITS_EMPTY_DETAIL).toMatch(/PLANNED/i);
    expect(SALESMAN_VISITS_EMPTY_DETAIL.toLowerCase()).toMatch(/pwa|completed|missed/);
    expect(SALESMAN_VISITS_EMPTY_DETAIL.toLowerCase()).not.toMatch(
      /gps|route planner|offline/,
    );
  });
});
