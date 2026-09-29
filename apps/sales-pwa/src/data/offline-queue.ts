const STORAGE_KEY = 'sales.offlineQueue.v1';

/**
 * Messages and expenses only. Orders are never queued: a retry could create
 * a second order after the first one already succeeded.
 */
export type OfflineJob =
  | { id: string; kind: 'message'; body: string }
  | {
      id: string;
      kind: 'expense';
      category: 'TRAVEL' | 'FOOD' | 'PHONE' | 'OTHER';
      amount: number;
      expenseDate: string;
      note: string | null;
    };

function readRaw(): OfflineJob[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(jobs: OfflineJob[]): void {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function listOfflineJobs(): OfflineJob[] {
  return readRaw();
}

export function enqueueOfflineJob(job: OfflineJob): void {
  const jobs = [...readRaw(), job];
  writeRaw(jobs);
  publishOfflineSync({ pending: jobs.length, failed: 0, phase: 'idle' });
}

export function replaceOfflineJobs(jobs: OfflineJob[]): void {
  writeRaw(jobs);
}

export function offlineJobCount(): number {
  return readRaw().length;
}

export type OfflineSyncPhase = 'idle' | 'syncing' | 'sent' | 'failed';

export type OfflineSyncSnapshot = {
  pending: number;
  failed: number;
  phase: OfflineSyncPhase;
};

const listeners = new Set<() => void>();
let snapshot: OfflineSyncSnapshot = { pending: 0, failed: 0, phase: 'idle' };

export function getOfflineSyncSnapshot(): OfflineSyncSnapshot {
  return snapshot;
}

export function subscribeOfflineSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishOfflineSync(next: OfflineSyncSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}
