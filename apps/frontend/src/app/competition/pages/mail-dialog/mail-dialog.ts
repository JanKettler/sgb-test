import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { RichEditor } from '../../../ui/rich-editor';
import { MailDraft } from '../../competition.store';

/** Mail window: recipients, subject, formatted text and the attachments, then "Jetzt verschicken". */
@Component({
  selector: 'app-mail-dialog',
  imports: [Icon, ModalDialog, RichEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-dialog [heading]="heading()" accent="amber" (closed)="closed.emit()">
      <div class="field">
        <label class="label" for="mail-to">An</label>
        <input
          id="mail-to"
          class="input"
          type="email"
          multiple
          autocomplete="off"
          [value]="to()"
          (input)="to.set(value($event))"
        />
      </div>
      <div class="field">
        <label class="label" for="mail-cc">Kopie (CC)</label>
        <input
          id="mail-cc"
          class="input"
          type="email"
          multiple
          autocomplete="off"
          [value]="cc()"
          (input)="cc.set(value($event))"
        />
      </div>
      <div class="field">
        <label class="label" for="mail-subject">Betreff</label>
        <input
          id="mail-subject"
          class="input"
          [value]="subject()"
          (input)="subject.set(value($event))"
        />
      </div>
      <div class="field">
        <span class="label">Inhalt der Mail</span>
        <app-rich-editor [(html)]="html" />
      </div>
      @if (draft().attachments.length > 0) {
        <p class="mb-2">
          <strong>Anhang:</strong>
          @for (name of draft().attachments; track name) {
            <span class="tag is-rounded ml-1"><app-icon name="download" /> {{ name }}</span>
          }
        </p>
      }
      <p class="help">
        Das Testportal hat noch keinen Mailserver: „Jetzt verschicken“ merkt sich die Mail nur im
        Postausgang. Über „Im Mailprogramm öffnen“ geht sie schon jetzt los, dort den Anhang bitte
        von Hand anfügen.
      </p>
      <ng-container dialogActions>
        <button
          type="button"
          class="button is-danger"
          title="Abbrechen"
          aria-label="Abbrechen"
          (click)="closed.emit()"
        >
          <app-icon name="x" />
        </button>
        <a class="button" [href]="mailto()"><app-icon name="mail" /> Im Mailprogramm öffnen</a>
        <button
          type="button"
          class="button is-success"
          [disabled]="!to().trim()"
          (click)="submit()"
        >
          <app-icon name="check" /> Jetzt verschicken
        </button>
      </ng-container>
    </app-modal-dialog>
  `,
})
export class MailDialog {
  readonly heading = input.required<string>();
  readonly draft = input.required<MailDraft>();
  readonly sent = output<MailDraft>();
  readonly closed = output();

  protected readonly to = linkedSignal(() => this.draft().to);
  protected readonly cc = linkedSignal(() => this.draft().cc);
  protected readonly subject = linkedSignal(() => this.draft().subject);
  protected readonly html = linkedSignal(() => this.draft().html);

  protected readonly mailto = computed(() => {
    const text = new DOMParser().parseFromString(
      this.html().replaceAll(/<\/(p|div|li)>|<br\s*\/?>/gi, '\n'),
      'text/html',
    ).body.textContent;
    const parts = [
      `subject=${encodeURIComponent(this.subject())}`,
      `body=${encodeURIComponent((text ?? '').trim())}`,
    ];
    if (this.cc().trim()) parts.push(`cc=${encodeURIComponent(this.cc().trim())}`);
    return `mailto:${encodeURIComponent(this.to().trim())}?${parts.join('&')}`;
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected submit(): void {
    this.sent.emit({
      to: this.to().trim(),
      cc: this.cc().trim(),
      subject: this.subject().trim(),
      html: this.html(),
      attachments: this.draft().attachments,
    });
  }
}
