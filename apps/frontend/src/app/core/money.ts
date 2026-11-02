/** An amount the German way: 1.234,50 €. */
export function euro(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Rounds to full cents, so sums of prices do not drift. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A typed amount such as "1.234,50" or "12,5 €" as a number; 0 when it is not a number. */
export function parseEuro(text: string): number {
  const value = Number(
    text
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, ''),
  );
  return Number.isFinite(value) ? value : 0;
}
