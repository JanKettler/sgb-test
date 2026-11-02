import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Action } from '../../ui/action';
import { ModalDialog } from '../../ui/modal-dialog';

/** Edits one short text, for example the name of a venue or a reason. */
@Component({
  selector: 'app-name-dialog',
  imports: [Action, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './name-dialog.html',
})
export class NameDialog {
  private readonly draft = signal<string | null>(null);

  readonly heading = input.required<string>();
  readonly label = input('Name');
  readonly initial = input('');
  readonly deletable = input(false);
  readonly saved = output<string>();
  readonly deleted = output();
  readonly closed = output();

  protected value(): string {
    return this.draft() ?? this.initial();
  }

  protected setValue(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }
}
