import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
} from '@angular/core';
import { Icon } from './icon';
import { isHexColor } from './rich-text';

export const TEXT_COLORS = [
  '#111827',
  '#dc2626',
  '#ea580c',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#6b7280',
];
export const MARK_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];
export const BACKGROUND_COLORS = [
  '#fff7d6',
  '#dcfce7',
  '#dbeafe',
  '#fce7f3',
  '#ffedd5',
  '#f3e8ff',
  '#e5e7eb',
];

/** Black or white, whichever reads better on the given background colour. */
export function readableOn(background: string): string {
  const hex = background.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [red, green, blue] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111827' : '#ffffff';
}

/** A colour: a few swatches, a free hex value and the device's own colour picker. */
@Component({
  selector: 'app-color-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-field.html',
  styleUrl: './color-field.scss',
})
export class ColorField {
  /** The chosen colour as hex, or empty for none. */
  readonly value = model('');
  readonly swatches = input<string[]>(TEXT_COLORS);
  readonly label = input('Farbe');

  protected readonly text = linkedSignal(() => this.value());
  protected readonly invalid = computed(() => this.text() !== '' && !isHexColor(this.text()));
  protected readonly native = computed(() => {
    const hex = this.value().replace('#', '');
    if (!isHexColor(this.value())) return '#000000';
    return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
  });

  protected pick(color: string): void {
    this.text.set(color);
    this.value.set(color);
  }

  protected type(event: Event): void {
    const typed = (event.target as HTMLInputElement).value.trim();
    const text = typed && !typed.startsWith('#') ? `#${typed}` : typed;
    this.text.set(text);
    if (isHexColor(text)) this.value.set(text.toLowerCase());
  }
}
