const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Server amounts are exact to the paisa; show paise only when present. */
export function formatMoney(amount: number): string {
  return INR.format(amount);
}
