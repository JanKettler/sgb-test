import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { euro } from '../../competition/competition.models';
import { Action } from '../../ui/action';
import { DateField } from '../../ui/date-field';
import { ModalDialog } from '../../ui/modal-dialog';
import { DENOMINATIONS, denominationLabel, roundCents } from '../cash.models';

/** What the dialog hands back: the pieces by value, the sum and the note. */
export interface CountResult {
  date: string;
  pieces: Record<string, number>;
  counted: number;
  note: string;
}

/** Cash count: the number of notes and coins is typed, the sum and the difference follow. */
@Component({
  selector: 'app-count-dialog',
  imports: [ModalDialog, Action, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './count-dialog.html',
  styleUrl: './count-dialog.scss',
})
export class CountDialog {
  /** The balance of the cash book that the count is compared with. */
  readonly expected = input.required<number>();
  readonly today = input.required<string>();
  /** The pieces of the last count, so a similar box does not have to be typed again. */
  readonly start = input<Record<string, number>>({});
  readonly saved = output<CountResult>();
  readonly closed = output();

  protected readonly euro = euro;
  protected readonly label = denominationLabel;
  protected readonly denominations = DENOMINATIONS;

  protected readonly date = signal('');
  protected readonly note = signal('');
  private readonly typed = signal<Record<string, string>>({});

  protected readonly total = computed(() =>
    roundCents(DENOMINATIONS.reduce((sum, value) => sum + this.subtotal(value), 0)),
  );
  protected readonly difference = computed(() => roundCents(this.total() - this.expected()));

  protected pieceCount(value: number): number {
    const key = String(value);
    const text = this.typed()[key];
    const number = text === undefined ? (this.start()[key] ?? 0) : Number(text);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  }

  protected subtotal(value: number): number {
    return roundCents(this.pieceCount(value) * value);
  }

  protected shown(value: number): string {
    const count = this.pieceCount(value);
    return count > 0 ? String(count) : '';
  }

  protected setPieces(value: number, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.typed.update((current) => ({ ...current, [String(value)]: text }));
  }

  protected setNote(event: Event): void {
    this.note.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    const pieces: Record<string, number> = {};
    for (const value of DENOMINATIONS) {
      if (this.pieceCount(value) > 0) pieces[String(value)] = this.pieceCount(value);
    }
    this.saved.emit({
      date: this.date() || this.today(),
      pieces,
      counted: this.total(),
      note: this.note().trim(),
    });
  }
}
