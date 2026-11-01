import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Action, ActionKind } from './action';
import { ModalDialog } from './modal-dialog';

/** Small yes/no question, e.g. before something is deleted. Replaces native confirm(). */
@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalDialog, Action],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-dialog
      [heading]="heading()"
      [subtitle]="subtitle()"
      [compact]="true"
      accent="red"
      (closed)="closed.emit()"
    >
      <p>{{ text() }}</p>
      <ng-container dialogActions>
        <app-action kind="cancel" withText (pressed)="closed.emit()" />
        <app-action
          [kind]="confirmKind()"
          withText
          [label]="confirmLabel()"
          (pressed)="confirmed.emit()"
        />
      </ng-container>
    </app-modal-dialog>
  `,
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly text = input('');
  readonly confirmLabel = input('Löschen');
  readonly confirmKind = input<ActionKind>('delete');
  readonly confirmed = output();
  readonly closed = output();
}
