/** An amount the German way: 1.234,50 €. */
export function euro(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Rounds to full cents, so sums of prices do not drift. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
