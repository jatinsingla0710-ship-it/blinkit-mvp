export const EMAIL_CODE_RESEND_MS = 30_000;

export function resendWaitSeconds(now: number, availableAt: number): number {
  if (availableAt <= now) return 0;
  return Math.ceil((availableAt - now) / 1000);
}
