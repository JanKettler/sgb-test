import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { Action } from './action';
import { DateField } from './date-field';
import { DialogAccent, ModalDialog } from './modal-dialog';

export const FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'time',
  'number',
  'select',
  'checkbox',
  'tags',
  'lines',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  value: string;
  label: string;
}

/** One input of a form dialog. */
export interface FieldDef {
  key: string;
  label: string;
  /** Text by default. "tags" are separated by commas, "lines" by line breaks. */
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** The choices of a select field. */
  options?: readonly FieldOption[];
  rows?: number;
  /** Suggestions that are offered while typing (text and tags). */
  suggestions?: readonly string[];
}

/** What the dialog hands back: numbers stay text (see `numberOf`), tags and lines become lists. */
export type FormValue = string | boolean | string[];
export type FormValues = Record<string, FormValue>;

export function textOf(values: FormValues, key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** A number typed with a comma or a dot; 0 when the field is empty or not a number. */
export function numberOf(values: FormValues, key: string): number {
  const number = Number(textOf(values, key).replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

export function flagOf(values: FormValues, key: string): boolean {
  return values[key] === true;
}

export function listOf(values: FormValues, key: string): string[] {
  const value = values[key];
  return Array.isArray(value) ? value : [];
}

function splitList(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

let nextDialog = 0;

/**
 * Dialog with a form that is described by its fields: text, number, date, select, checkbox and
 * lists. Required fields and an optional extra check are verified before `saved` is emitted.
 */
@Component({
  selector: 'app-form-dialog',
  imports: [ModalDialog, Action, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-dialog.html',
  // Enter in a single line field saves; a listener on the host keeps the template free of
  // handlers on elements that cannot take the focus.
  host: { '(keydown.enter)': 'enter($event)' },
})
export class FormDialog {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly accent = input<DialogAccent>('green');
  readonly fields = input.required<readonly FieldDef[]>();
  /** The record that is edited: text, numbers, flags and lists are taken over by field key. */
  readonly values = input<object>({});
  readonly saveLabel = input('Speichern');
  /** Extra check of the whole form; returns the error text, or an empty text when it is fine. */
  readonly check = input<((values: FormValues) => string) | null>(null);
  readonly saved = output<FormValues>();
  readonly closed = output();

  private readonly uid = ++nextDialog;
  protected readonly draft = linkedSignal<Record<string, string | boolean>>(() => this.toDraft());
  protected readonly invalid = signal(false);
  protected readonly error = signal('');

  protected idOf(key: string): string {
    return `form-${this.uid}-${key}`;
  }

  protected text(key: string): string {
    const value = this.draft()[key];
    return typeof value === 'string' ? value : '';
  }

  protected flag(key: string): boolean {
    return this.draft()[key] === true;
  }

  protected isWide(field: FieldDef): boolean {
    return field.type === 'textarea' || field.type === 'lines' || field.type === 'tags';
  }

  protected bad(field: FieldDef): boolean {
    return this.invalid() && this.missing(field);
  }

  protected set(key: string, value: string | boolean): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected setText(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected setFlag(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).checked);
  }

  /** Enter in a single line field saves, like the button does. */
  enter(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox') {
      event.preventDefault();
      this.save();
    }
  }

  protected save(): void {
    const missing = this.fields().some((field) => this.missing(field));
    if (missing) {
      this.invalid.set(true);
      this.error.set('Bitte alle Felder mit * ausfüllen.');
      return;
    }
    const values = this.collect();
    const problem = this.check()?.(values) ?? '';
    if (problem) {
      this.invalid.set(true);
      this.error.set(problem);
      return;
    }
    this.saved.emit(values);
  }

  private missing(field: FieldDef): boolean {
    if (field.required !== true || field.type === 'checkbox') return false;
    const value = this.draft()[field.key];
    return typeof value !== 'string' || value.trim() === '';
  }

  private toDraft(): Record<string, string | boolean> {
    const initial = this.values() as Record<string, unknown>;
    const draft: Record<string, string | boolean> = {};
    for (const field of this.fields()) {
      const value = initial[field.key];
      if (field.type === 'checkbox') draft[field.key] = value === true;
      else if (Array.isArray(value)) draft[field.key] = value.join(this.separator(field));
      else if (typeof value === 'string') draft[field.key] = value;
      else if (typeof value === 'number') draft[field.key] = String(value);
      else draft[field.key] = '';
      // A select shows its first choice, so that is also what it holds until it is changed.
      const first = field.options?.[0];
      if (field.type === 'select' && draft[field.key] === '' && first) {
        draft[field.key] = first.value;
      }
    }
    return draft;
  }

  private separator(field: FieldDef): string {
    return field.type === 'lines' ? '\n' : ', ';
  }

  private collect(): FormValues {
    const values: FormValues = {};
    for (const field of this.fields()) {
      const raw = this.draft()[field.key];
      if (field.type === 'checkbox') {
        values[field.key] = raw === true;
        continue;
      }
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (field.type === 'tags') values[field.key] = splitList(text, /[,;]/);
      else if (field.type === 'lines') values[field.key] = splitList(text, /\r?\n/);
      else values[field.key] = text;
    }
    return values;
  }
}
