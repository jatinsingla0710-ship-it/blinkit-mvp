export type ToastTone = 'success' | 'error' | 'warning';

export type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

/** Keeps the stack short on a small screen; the newest toast is always shown. */
export const MAX_VISIBLE_TOASTS = 3;

export function pushToast(list: ToastItem[], toast: ToastItem): ToastItem[] {
  return [...list, toast].slice(-MAX_VISIBLE_TOASTS);
}

export function removeToast(list: ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}

/** Errors stay longer so they can be read in the field. */
export function toastDurationMs(tone: ToastTone): number {
  return tone === 'error' ? 7000 : 4000;
}
