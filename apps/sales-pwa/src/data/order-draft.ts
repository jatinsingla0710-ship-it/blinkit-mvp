/**
 * Local-only cart draft. A draft is never an order: it is not sent to Supabase
 * and is only priced / submitted when the salesman explicitly continues online.
 */

export type OrderDraftLine = { skuId: string; quantity: number };

export type OrderDraft = {
  version: 1;
  shopId: string;
  lines: OrderDraftLine[];
  notes: string;
  updatedAt: string;
};

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'groaurum.sales.orderDraft.v1:';

export function draftStorageKey(profileId: string): string {
  return `${PREFIX}${profileId}`;
}

function defaultStorage(): DraftStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isLine(value: unknown): value is OrderDraftLine {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.skuId === 'string' &&
    typeof v.quantity === 'number' &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0
  );
}

export function loadOrderDraft(
  profileId: string,
  storage: DraftStorage | null = defaultStorage(),
): OrderDraft | null {
  if (!storage || !profileId) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey(profileId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== 1 || typeof parsed.shopId !== 'string') return null;
    const lines = Array.isArray(parsed.lines) ? parsed.lines.filter(isLine) : [];
    return {
      version: 1,
      shopId: parsed.shopId,
      lines,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Empty drafts are removed rather than stored. Returns false if storage failed. */
export function saveOrderDraft(
  profileId: string,
  draft: Omit<OrderDraft, 'version' | 'updatedAt'>,
  storage: DraftStorage | null = defaultStorage(),
  now: Date = new Date(),
): boolean {
  if (!storage || !profileId) return false;
  try {
    if (!draft.shopId && draft.lines.length === 0 && !draft.notes.trim()) {
      storage.removeItem(draftStorageKey(profileId));
      return true;
    }
    const value: OrderDraft = {
      version: 1,
      shopId: draft.shopId,
      lines: draft.lines.filter(isLine),
      notes: draft.notes,
      updatedAt: now.toISOString(),
    };
    storage.setItem(draftStorageKey(profileId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearOrderDraft(
  profileId: string,
  storage: DraftStorage | null = defaultStorage(),
): void {
  if (!storage || !profileId) return;
  try {
    storage.removeItem(draftStorageKey(profileId));
  } catch {
    // Storage unavailable (private mode / quota): nothing persisted to clear.
  }
}

/** Upsert one SKU; quantity 0 removes it. Keeps one line per SKU (order_lines is unique per SKU). */
export function setDraftLine(
  lines: readonly OrderDraftLine[],
  skuId: string,
  quantity: number,
): OrderDraftLine[] {
  const rest = lines.filter((l) => l.skuId !== skuId);
  if (quantity <= 0) return rest;
  const idx = lines.findIndex((l) => l.skuId === skuId);
  const next = { skuId, quantity };
  if (idx === -1) return [...rest, next];
  const out = [...lines];
  out[idx] = next;
  return out;
}
