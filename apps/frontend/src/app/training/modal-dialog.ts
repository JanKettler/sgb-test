import { Component, input, output } from '@angular/core';

/** Bulma modal. Replaces native confirm()/alert() and hosts all small dialogs. */
@Component({
  selector: 'app-modal-dialog',
  templateUrl: './modal-dialog.html',
})
export class ModalDialog {
  readonly heading = input.required<string>();
  readonly wide = input(false);
  readonly closed = output<void>();
}
