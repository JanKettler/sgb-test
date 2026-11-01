import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Icon } from '../../ui/icon';
import { Block } from './evaluation.model';
import { EvaluationStore } from './evaluation.store';

/**
 * One title, table, sum line or note of the evaluation, drawn like the sheet of the Excel file.
 * The fee of a meet and the "Zählt" switch of a judge can be changed right in the table.
 */
@Component({
  selector: 'app-evaluation-block',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluation-block.html',
  styleUrl: './evaluation-block.scss',
})
export class EvaluationBlock {
  private readonly store = inject(EvaluationStore);

  readonly block = input.required<Block>();

  /** The meet whose fee is being typed, and the text typed so far. */
  protected readonly editing = signal<string | null>(null);
  protected readonly draft = signal('');

  protected edit(id: string, value: number | null): void {
    this.draft.set(value === null ? '' : String(value).replace('.', ','));
    this.editing.set(id);
  }

  protected typed(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  /** Saves the typed fee; an empty field goes back to the sum of the entries. */
  protected save(id: string): void {
    const text = this.draft().trim().replace(',', '.');
    const value = text === '' ? null : Number(text);
    // A text that is no amount stays open, so the typo can be fixed.
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    this.store.setFee(id, value);
    this.editing.set(null);
  }

  protected reset(id: string): void {
    this.store.setFee(id, null);
  }

  protected toggleJudge(name: string): void {
    this.store.toggleJudge(name);
  }
}
