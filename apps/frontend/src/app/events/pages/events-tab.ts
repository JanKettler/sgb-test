import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { emptyTask } from '../../tasks/tasks.models';
import { TasksStore } from '../../tasks/tasks.store';
import { addDays, dayMonth, fullDate, weekdayShort } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, listOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { StartStore } from '../../start/start.store';
import { eventBook, eventFilename } from '../events.export';
import {
  ChecklistPoint,
  EVENT_STATES,
  EventPlan,
  PHASES,
  categoriesOf,
  emptyEvent,
  progressOf,
  stateOf,
} from '../events.models';
import { EventsStore } from '../events.store';

const CATEGORY_HINTS: readonly string[] = Object.values(PHASES);

const HELPER_FIELDS: readonly FieldDef[] = [
  { key: 'name', label: 'Name oder Mitgliedsnummer', required: true },
  { key: 'task', label: 'Aufgabe (optional)', placeholder: 'z. B. Kuchenverkauf' },
];

/** The events with their checklists and helpers; open an event to see and tick the points. */
@Component({
  selector: 'app-events-list',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-tab.html',
})
export class EventsTab {
  protected readonly store = inject(EventsStore);
  private readonly tasks = inject(TasksStore);
  private readonly start = inject(StartStore);
  private readonly toasts = inject(Toasts);
  protected readonly progressOf = progressOf;
  protected readonly categoriesOf = categoriesOf;
  protected readonly fullDate = fullDate;

  protected readonly query = signal('');
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly editing = signal<EventPlan | null>(null);
  protected readonly toDelete = signal<EventPlan | null>(null);
  protected readonly pointEdit = signal<{ plan: EventPlan; point: ChecklistPoint } | null>(null);
  protected readonly pointDelete = signal<{ plan: EventPlan; point: ChecklistPoint } | null>(null);
  protected readonly helperFor = signal<EventPlan | null>(null);
  protected readonly templateFor = signal<EventPlan | null>(null);
  protected readonly tasksFor = signal<EventPlan | null>(null);

  protected readonly helperFields = computed<FieldDef[]>(() =>
    HELPER_FIELDS.map((field) =>
      field.key === 'name' ? { ...field, suggestions: this.store.memberNames() } : field,
    ),
  );
  protected readonly helperValues = computed(() => ({ name: this.start.userName() }));

  protected readonly eventFields = computed<FieldDef[]>(() => [
    { key: 'title', label: 'Name', required: true },
    { key: 'date', label: 'Datum', type: 'date' },
    { key: 'time', label: 'Uhrzeit', type: 'time' },
    { key: 'place', label: 'Ort' },
    {
      key: 'state',
      label: 'Stand',
      type: 'select',
      options: EVENT_STATES.map((state) => ({ value: state, label: state })),
    },
    {
      key: 'templateId',
      label: 'Checkliste aus Vorlage ergänzen',
      type: 'select',
      options: [
        { value: '', label: '– keine –' },
        ...this.store.sortedTemplates().map((t) => ({ value: t.id, label: t.title })),
      ],
    },
    { key: 'material', label: 'Material' },
    { key: 'description', label: 'Beschreibung', type: 'textarea', rows: 3 },
  ]);

  protected readonly templateFields = computed<FieldDef[]>(() => [
    {
      key: 'templateId',
      label: 'Vorlage',
      type: 'select',
      options: this.store.sortedTemplates().map((t) => ({ value: t.id, label: t.title })),
    },
  ]);

  protected readonly pointFields = computed<FieldDef[]>(() => [
    { key: 'text', label: 'Punkt', required: true },
    { key: 'who', label: 'Zuständig', type: 'tags', suggestions: this.store.memberNames() },
    { key: 'due', label: 'Frist', type: 'date' },
    {
      key: 'category',
      label: 'Kategorie',
      required: true,
      suggestions: this.categorySuggestions(),
      hint: `Zum Beispiel: ${this.categorySuggestions().join(', ')}`,
    },
  ]);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .sorted()
      .filter(
        (plan) =>
          !query ||
          `${plan.title} ${plan.place} ${plan.description}`.toLocaleLowerCase('de').includes(query),
      );
  });

  protected readonly openPoints = computed(
    () => this.tasksFor()?.checklist.filter((point) => !point.done) ?? [],
  );

  /** The helper check: the typed name has to be in the member list. */
  protected readonly helperCheck = (values: FormValues): string =>
    this.known(textOf(values, 'name'))
      ? ''
      : `„${textOf(values, 'name')}“ steht nicht in der Mitgliederliste. Bitte einen Namen oder eine Mitgliedsnummer aus der Vorschlagsliste wählen.`;

  private known(typed: string): boolean {
    return this.store.resolveName(typed, this.start.userName()) !== null;
  }

  private categorySuggestions(): string[] {
    const used = this.store.events().flatMap((plan) => categoriesOf(plan.checklist));
    return [...new Set([...CATEGORY_HINTS, ...used])];
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

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

  protected when(plan: EventPlan): string {
    if (!plan.date) return [plan.place, 'Termin offen'].filter(Boolean).join(' · ');
    const days = this.start.daysTo(plan.date);
    const soon =
      plan.state !== 'Abgeschlossen' && days >= 0 && days <= 30 ? ` (in ${days} Tg.)` : '';
    const time = plan.time ? `, ${plan.time} Uhr` : '';
    return [`${weekdayShort(plan.date)} ${fullDate(plan.date)}${time}${soon}`, plan.place]
      .filter(Boolean)
      .join(' · ');
  }

  protected pointsIn(plan: EventPlan, category: string): ChecklistPoint[] {
    return plan.checklist.filter((point) => point.category === category);
  }

  protected doneIn(plan: EventPlan, category: string): number {
    return this.pointsIn(plan, category).filter((point) => point.done).length;
  }

  protected late(point: ChecklistPoint): boolean {
    return !point.done && point.due !== '' && point.due < this.store.today;
  }

  protected dueText(point: ChecklistPoint): string {
    return point.due ? `bis ${dayMonth(point.due)}` : '';
  }

  protected canRemoveHelper(name: string): boolean {
    return this.store.canEdit() || name === this.start.userName();
  }

  protected add(): void {
    this.editing.set(emptyEvent(this.store.today));
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.save(
      {
        ...current,
        title: textOf(values, 'title'),
        date: textOf(values, 'date'),
        time: textOf(values, 'time'),
        place: textOf(values, 'place'),
        state: stateOf(textOf(values, 'state')),
        material: textOf(values, 'material'),
        description: textOf(values, 'description'),
      },
      textOf(values, 'templateId'),
    );
    this.toasts.saved(current.id ? 'Veranstaltung gespeichert' : 'Veranstaltung angelegt');
    this.editing.set(null);
  }

  protected confirmDelete(): void {
    const plan = this.toDelete();
    if (plan) {
      this.store.remove(plan.id);
      this.toasts.saved('Veranstaltung gelöscht');
    }
    this.toDelete.set(null);
  }

  protected toggle(plan: EventPlan, point: ChecklistPoint): void {
    this.store.toggle(plan.id, point.id, this.start.userName());
  }

  protected addPoint(plan: EventPlan): void {
    const last = plan.checklist.at(-1);
    this.pointEdit.set({
      plan,
      point: {
        id: '',
        text: '',
        category: last?.category ?? PHASES.before,
        done: false,
        doneBy: '',
        due: '',
        who: [],
      },
    });
  }

  protected savePoint(values: FormValues): void {
    const edit = this.pointEdit();
    if (!edit) return;
    this.store.savePoint(edit.plan.id, {
      ...edit.point,
      text: textOf(values, 'text'),
      category: textOf(values, 'category'),
      due: textOf(values, 'due'),
      who: listOf(values, 'who'),
    });
    this.toasts.saved('Punkt gespeichert');
    this.pointEdit.set(null);
  }

  protected confirmPointDelete(): void {
    const target = this.pointDelete();
    if (target) {
      this.store.removePoint(target.plan.id, target.point.id);
      this.toasts.saved('Punkt gelöscht');
    }
    this.pointDelete.set(null);
  }

  protected applyTemplate(values: FormValues): void {
    const plan = this.templateFor();
    if (plan) {
      this.store.applyTemplate(plan.id, textOf(values, 'templateId'));
      this.toasts.saved('Punkte aus der Vorlage ergänzt');
    }
    this.templateFor.set(null);
  }

  protected addHelper(values: FormValues): void {
    const plan = this.helperFor();
    if (!plan) return;
    const added = this.store.addHelper(
      plan.id,
      textOf(values, 'name'),
      textOf(values, 'task'),
      this.start.userName(),
    );
    if (added) this.toasts.saved('Helfer eingetragen');
    else this.toasts.failed('Der Name steht nicht in der Mitgliederliste');
    this.helperFor.set(null);
  }

  protected removeHelper(plan: EventPlan, helperId: string): void {
    this.store.removeHelper(plan.id, helperId);
    this.toasts.saved('Helfer entfernt');
  }

  /** Creates a task of the board for every open point of the checklist. */
  protected createTasks(): void {
    const plan = this.tasksFor();
    if (plan) {
      for (const point of plan.checklist.filter((entry) => !entry.done)) {
        this.tasks.save({
          ...emptyTask(this.start.userName()),
          title: point.text,
          text: `Aus der Checkliste von „${plan.title}“`,
          who: point.who.map((name) => name.split(' ')[0]),
          due: point.due || (plan.date ? addDays(plan.date, -1) : ''),
          link: '/veranstaltungen',
        });
      }
      this.toasts.saved('Aufgaben angelegt');
    }
    this.tasksFor.set(null);
  }

  protected exportExcel(plan: EventPlan): void {
    if (plan.checklist.length === 0 && plan.helpers.length === 0) {
      this.toasts.show('Noch keine Checkliste oder Helfer.', 'info');
      return;
    }
    downloadXlsx(eventFilename(plan), eventBook(plan));
  }
}
