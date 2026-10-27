import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ModalDialog } from '../../ui/modal-dialog';
import { TrainingStore } from '../training.store';

/** Demo mail dialog: shows the recipients and a text, but never sends anything. */
@Component({
  selector: 'app-mail-dialog',
  imports: [ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mail-dialog.html',
})
export class MailDialog {
  protected readonly store = inject(TrainingStore);
  private readonly subjectDraft = signal<string | null>(null);
  private readonly textDraft = signal<string | null>(null);

  readonly recipients = input.required<string[]>();
  /** Template that is filled in at the start, with the first name of a single recipient. */
  readonly templateId = input('');
  readonly closed = output();
  readonly sent = output<number>();

  protected subject(): string {
    const draft = this.subjectDraft();
    if (draft !== null) return draft;
    return this.store.templates().find((item) => item.id === this.templateId())?.subject ?? '';
  }

  protected text(): string {
    const draft = this.textDraft();
    if (draft !== null) return draft;
    const [first] = this.recipients();
    return this.recipients().length === 1
      ? this.store.templateText(this.templateId(), first)
      : (this.store.templates().find((item) => item.id === this.templateId())?.text ?? '');
  }

  protected applyTemplate(event: Event): void {
    const template = this.store
      .templates()
      .find((item) => item.id === (event.target as HTMLSelectElement).value);
    this.subjectDraft.set(template?.subject ?? '');
    this.textDraft.set(template?.text ?? '');
  }

  protected setSubject(event: Event): void {
    this.subjectDraft.set((event.target as HTMLInputElement).value);
  }

  protected setText(event: Event): void {
    this.textDraft.set((event.target as HTMLTextAreaElement).value);
  }
}
