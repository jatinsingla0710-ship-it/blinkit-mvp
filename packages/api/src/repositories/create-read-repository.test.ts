import { describe, expect, it } from 'vitest';
import { createMockReadRepository } from './create-read-repository';

describe('createMockReadRepository', () => {
  it('lists, gets, and searches seed rows', async () => {
    const repo = createMockReadRepository(
      'products',
      {
        list: () => [
          { id: 'a', name: 'Almonds' },
          { id: 'b', name: 'Cashews' },
        ],
        getById: (id) =>
          id === 'a' ? { id: 'a', name: 'Almonds', detail: true } : null,
        search: (q) =>
          [{ id: 'a', name: 'Almonds' }, { id: 'b', name: 'Cashews' }].filter(
            (row) => row.name.toLowerCase().includes(q),
          ),
      },
    );

    expect(await repo.list()).toHaveLength(2);
    expect(await repo.getById('a')).toEqual({
      id: 'a',
      name: 'Almonds',
      detail: true,
    });
    expect(await repo.search('cash')).toEqual([{ id: 'b', name: 'Cashews' }]);
  });
});
