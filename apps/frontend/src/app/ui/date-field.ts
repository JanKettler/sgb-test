import { ChangeDetectionStrategy, Component, input, linkedSignal, model } from '@angular/core';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 2026-03-09 -> 09.03.2026 */
function toGerman(iso: string): string {
  if (!ISO.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/** Digits only, with the dots set automatically: 0903 -> 09.03 */
function format(digits: string): string {
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter((part) => part !== '').join('.');
}

/** 09.03.2026 -> 2026-03-09, or null when it is not a real date. */
function toIso(text: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/**
 * Date input that can be typed: "09032026" becomes 09.03.2026. The value is an ISO date, or an
 * empty string when the field is empty (an open end, for example).
 */
@Component({
  selector: 'app-date-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      class="input"
      inputmode="numeric"
      autocomplete="off"
      placeholder="TT.MM.JJJJ"
      maxlength="10"
      [id]="inputId()"
      [attr.aria-label]="label() || null"
      [value]="text()"
      (input)="typed($event)"
      (blur)="settle($event)"
    />
  `,
})
export class DateField {
  readonly value = model('');
  readonly inputId = input('');
  readonly label = input('');

  protected readonly text = linkedSignal(() => toGerman(this.value()));

  protected typed(event: Event): void {
    const field = event.target as HTMLInputElement;
    const digits = field.value.replace(/\D/g, '').slice(0, 8);
    const text = format(digits);
    field.value = text;
    this.text.set(text);
    if (digits === '') this.value.set('');
    else {
      const iso = toIso(text);
      if (iso) this.value.set(iso);
    }
  }

  /** An unfinished or impossible date falls back to the last valid one. */
  protected settle(event: Event): void {
    const field = event.target as HTMLInputElement;
    const text = toGerman(this.value());
    if (field.value !== '' && toIso(field.value) === null) {
      field.value = text;
      this.text.set(text);
    }
  }
}
