import { Component, input, output, signal } from '@angular/core';
import { ModalDialog } from './modal-dialog';

interface MailTemplate {
  label: string;
  subject: string;
  text: string;
}

const TEMPLATES: readonly MailTemplate[] = [
  { label: 'Leer', subject: '', text: '' },
  {
    label: 'Erinnerung Training',
    subject: 'Erinnerung: Training',
    text: 'Hallo zusammen,\n\nwir erinnern euch an das anstehende Training. Bitte denkt an eure Rückmeldung.\n\nSportliche Grüße\nDas Trainerteam',
  },
  {
    label: 'Terminänderung',
    subject: 'Änderung beim Training',
    text: 'Hallo zusammen,\n\nleider ändert sich der Termin. Alle Details findet ihr im Portal.\n\nSportliche Grüße\nDas Trainerteam',
  },
];

/** Demo mail dialog: shows the recipients and a text, but never sends anything. */
@Component({
  selector: 'app-mail-dialog',
  imports: [ModalDialog],
  templateUrl: './mail-dialog.html',
})
export class MailDialog {
  readonly recipients = input.required<string[]>();
  readonly initialSubject = input('');
  readonly initialText = input('');
  readonly closed = output<void>();
  readonly sent = output<number>();

  protected readonly templates = TEMPLATES;
  private readonly subjectOverride = signal<string | null>(null);
  private readonly textOverride = signal<string | null>(null);

  protected subject(): string {
    return this.subjectOverride() ?? this.initialSubject();
  }

  protected text(): string {
    return this.textOverride() ?? this.initialText();
  }

  protected setSubject(event: Event): void {
    this.subjectOverride.set((event.target as HTMLInputElement).value);
  }

  protected setText(event: Event): void {
    this.textOverride.set((event.target as HTMLTextAreaElement).value);
  }

  protected applyTemplate(event: Event): void {
    const template = TEMPLATES[Number((event.target as HTMLSelectElement).value)];
    this.subjectOverride.set(template.subject);
    this.textOverride.set(template.text);
  }
}
