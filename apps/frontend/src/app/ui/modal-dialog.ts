import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type DialogAccent = 'navy' | 'amber' | 'violet' | 'green' | 'red';

/** Small card dialog with a coloured top edge. Replaces native confirm() and alert(). */
@Component({
  selector: 'app-modal-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-dialog.html',
  styleUrl: './modal-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ModalDialog {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
  /** Colour of the badge: one of the pill tones, e.g. "is-ok". */
  readonly badgeTone = input('is-violet');
  readonly accent = input<DialogAccent>('navy');
  /** Small yes/no question; all other dialogs share one width. */
  readonly compact = input(false);
  /** Kept so existing templates compile; every dialog is wide by default now. */
  readonly wide = input(true);
  readonly closed = output();
}
