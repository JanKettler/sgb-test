import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ModalDialog } from '../../ui/modal-dialog';
import { MailTemplate } from '../training.models';

/** Edits a mail template. A template without an id is new. */
@Component({
  selector: 'app-template-dialog',
  imports: [ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-dialog.html',
})
export class TemplateDialog {
  private readonly draft = signal<Partial<MailTemplate>>({});

  readonly template = input.required<MailTemplate>();
  readonly saved = output<MailTemplate>();
  readonly deleted = output();
  readonly closed = output();

  protected current(): MailTemplate {
    return { ...this.template(), ...this.draft() };
  }

  protected patch(change: Partial<MailTemplate>): void {
    this.draft.update((value) => ({ ...value, ...change }));
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
