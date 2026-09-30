import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SalesmanOrderPreview } from '@groaurum/api-client';
import type { SalesmanApi } from '@/data/salesmanApi';
import type { OrderDraftLine } from '@/data/order-draft';

export const PREVIEW_DEBOUNCE_MS = 450;

/** Order-sensitive: the RPC returns lines in request order. */
export function cartKey(lines: readonly OrderDraftLine[]): string {
  return lines.map((l) => `${l.skuId}:${l.quantity}`).join('|');
}

/** A preview only describes the cart when every SKU and quantity match. */
export function previewMatchesCart(
  preview: SalesmanOrderPreview | undefined,
  lines: readonly OrderDraftLine[],
): preview is SalesmanOrderPreview {
  if (!preview || preview.lines.length !== lines.length) return false;
  return preview.lines.every(
    (pl, i) => pl.skuId === lines[i].skuId && pl.quantity === lines[i].quantity,
  );
}

export type PreviewChange = { skuId: string; before: number | null; after: number | null };

/**
 * Differences between the reviewed preview and a fresh one. Anything here
 * means the salesman must review again before submitting.
 */
export function diffPreviews(
  reviewed: SalesmanOrderPreview,
  fresh: SalesmanOrderPreview,
): { totalChanged: boolean; validityChanged: boolean; lines: PreviewChange[] } {
  const lines: PreviewChange[] = [];
  const freshBySku = new Map(fresh.lines.map((l) => [l.skuId, l]));
  for (const line of reviewed.lines) {
    const next = freshBySku.get(line.skuId);
    if (!next || next.lineTotal !== line.lineTotal || next.unitPrice !== line.unitPrice) {
      lines.push({ skuId: line.skuId, before: line.lineTotal, after: next?.lineTotal ?? null });
    }
  }
  return {
    totalChanged: reviewed.total !== fresh.total,
    validityChanged: reviewed.allValid !== fresh.allValid,
    lines,
  };
}

export function hasPreviewChanges(diff: ReturnType<typeof diffPreviews>): boolean {
  return diff.totalChanged || diff.validityChanged || diff.lines.length > 0;
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type OrderPreviewState = {
  /** Preview for exactly the current cart, or undefined. */
  current: SalesmanOrderPreview | undefined;
  /** Waiting for the debounce or the server. */
  pending: boolean;
  error: unknown;
  isError: boolean;
  retrying: boolean;
  retry: () => void;
};

/**
 * Server-priced cart. Never computes a total in the browser; while the
 * preview does not match the cart there is no total to show.
 */
export function useOrderPreview(
  api: SalesmanApi,
  lines: readonly OrderDraftLine[],
  online: boolean,
): OrderPreviewState {
  const key = cartKey(lines);
  const debouncedKey = useDebouncedValue(key, PREVIEW_DEBOUNCE_MS);
  const requestLines = useMemo(
    () =>
      debouncedKey
        ? debouncedKey.split('|').map((part) => {
            const [skuId, qty] = part.split(':');
            return { skuId, quantity: Number(qty) };
          })
        : [],
    [debouncedKey],
  );

  const query = useQuery({
    queryKey: ['sales', 'order-preview', debouncedKey],
    queryFn: () => api.previewOrderLines(requestLines),
    enabled: online && requestLines.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    placeholderData: (previous: SalesmanOrderPreview | undefined) => previous,
  });

  const current = previewMatchesCart(query.data, lines) ? query.data : undefined;
  const settledForKey = debouncedKey === key && !query.isFetching;

  return {
    current,
    pending: lines.length > 0 && online && !current && !(settledForKey && query.isError),
    error: query.error,
    isError: query.isError && settledForKey,
    retrying: query.isFetching,
    retry: () => {
      void query.refetch();
    },
  };
}
