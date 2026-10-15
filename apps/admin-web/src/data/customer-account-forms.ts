/**
 * Pure validation for Customer 2.0 receive-payment and opening-balance forms.
 */

export function validateCustomerCollectionAmount(
  amountRaw: string,
  outstanding: number,
  outstandingLabel: string,
): { ok: true; amount: number } | { ok: false; error: string } {
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }
  if (amount > outstanding + 0.001) {
    return {
      ok: false,
      error: `Amount cannot be more than outstanding (${outstandingLabel}).`,
    };
  }
  return { ok: true, amount };
}

export function validateOpeningBalanceForm(
  amountRaw: string,
  asOfDate: string,
): { ok: true; amount: number } | { ok: false; error: string } {
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }
  if (!asOfDate.trim()) {
    return { ok: false, error: 'Choose the as-of date.' };
  }
  return { ok: true, amount };
}
