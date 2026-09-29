import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueOfflineJob, listOfflineJobs, replaceOfflineJobs } from './offline-queue';

describe('offline queue', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('keeps a message until it is removed', () => {
    enqueueOfflineJob({ id: '1', kind: 'message', body: 'On my way' });
    expect(listOfflineJobs()).toEqual([{ id: '1', kind: 'message', body: 'On my way' }]);
    replaceOfflineJobs([]);
    expect(listOfflineJobs()).toEqual([]);
  });
});
