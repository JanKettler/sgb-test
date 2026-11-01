import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import {
  EventTemplate,
  TemplatePoint,
  categoriesOf,
  parseTemplateText,
  templateText,
} from '../events.models';
import { EventsStore } from '../events.store';

const FIELDS: readonly FieldDef[] = [
  { key: 'title', label: 'Name der Vorlage', required: true },
  {
    key: 'points',
    label: 'Checkliste',
    type: 'textarea',
    rows: 12,
    required: true,
    hint: 'Pro Zeile: Punkt | Kategorie | Tage zum Datum. Die Kategorie ist frei wählbar, z. B. Vorher, Aufbau, Verkauf oder Danach. Beispiel: „Halle bestätigen | Vorher | -90“.',
  },
];

interface TemplateDraft {
  id: string;
  title: string;
  points: string;
}

/** Checklist templates; applying one counts the deadlines from the date of the event. */
@Component({
  selector: 'app-event-templates',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './templates-tab.html',
})
export class TemplatesTab {
  protected readonly store = inject(EventsStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = FIELDS;
  protected readonly categoriesOf = categoriesOf;
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly editing = signal<TemplateDraft | null>(null);
  protected readonly toDelete = signal<EventTemplate | null>(null);

  protected readonly check = (values: FormValues): string =>
    parseTemplateText(textOf(values, 'points')).some((point) => point.text === '')
      ? 'In jeder Zeile muss ein Punkt stehen, vor dem ersten „|“.'
      : '';

  protected isOpen(id: string): boolean {
    return this.opened().has(id);
  }

  protected toggleOpen(id: string): void {
    this.opened.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected pointsIn(template: EventTemplate, category: string): TemplatePoint[] {
    return template.points.filter((point) => point.category === category);
  }

  protected days(point: TemplatePoint): string {
    return `${point.offset > 0 ? '+' : ''}${point.offset} Tg.`;
  }

  protected add(): void {
    this.editing.set({ id: '', title: '', points: '' });
  }

  protected edit(template: EventTemplate): void {
    this.editing.set({
      id: template.id,
      title: template.title,
      points: templateText(template.points),
    });
  }

  protected save(values: FormValues): void {
    const draft = this.editing();
    if (!draft) return;
    this.store.saveTemplate({
      id: draft.id,
      title: textOf(values, 'title'),
      points: parseTemplateText(textOf(values, 'points')),
    });
    this.toasts.saved(draft.id ? 'Vorlage gespeichert' : 'Vorlage angelegt');
    this.editing.set(null);
  }

  protected addStandards(): void {
    this.store.addStandardTemplates();
    this.toasts.saved('Standard-Vorlagen angelegt');
  }

  protected confirmDelete(): void {
    const template = this.toDelete();
    if (template) {
      this.store.removeTemplate(template.id);
      this.toasts.saved('Vorlage gelöscht');
    }
    this.toDelete.set(null);
  }
}
