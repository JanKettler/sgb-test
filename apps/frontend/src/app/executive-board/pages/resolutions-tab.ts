import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { StartStore } from '../../start/start.store';
import { emptyTask } from '../../tasks/tasks.models';
import { TasksStore } from '../../tasks/tasks.store';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, listOf, textOf } from '../../ui/form-dialog';
import { SearchField } from '../../ui/search-field';
import { Toasts } from '../../ui/toast';
import { resolutionsBook } from '../executive-board.export';
import {
  RESOLUTION_LABEL,
  RESOLUTION_STATES,
  Resolution,
  emptyResolution,
  isOpen,
  isOverdue,
  resolutionStateOf,
} from '../executive-board.models';
import { ExecutiveBoardStore } from '../executive-board.store';

const STATE_OPTIONS = RESOLUTION_STATES.map((state) => ({
  value: state,
  label: RESOLUTION_LABEL[state],
}));

const FIELDS: readonly FieldDef[] = [
  { key: 'title', label: 'Beschluss', required: true },
  {
    key: 'number',
    label: 'Nummer',
    placeholder: 'z. B. 2026/12',
    hint: 'Leer lassen: die nächste freie Nummer wird vergeben.',
  },
  { key: 'date', label: 'Beschlossen am', type: 'date' },
  {
    key: 'who',
    label: 'Zuständig (Vornamen)',
    type: 'tags',
    hint: 'Mehrere Namen mit Komma trennen.',
  },
  { key: 'due', label: 'Frist', type: 'date' },
  { key: 'state', label: 'Stand', type: 'select', options: STATE_OPTIONS },
  { key: 'text', label: 'Text und Umsetzung', type: 'textarea', rows: 4 },
];

/** The decisions of the board with responsible people and deadlines. */
@Component({
  selector: 'app-board-resolutions',
  imports: [Action, FormDialog, ConfirmDialog, SearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resolutions-tab.html',
})
export class ResolutionsTab {
  protected readonly store = inject(ExecutiveBoardStore);
  private readonly tasks = inject(TasksStore);
  private readonly start = inject(StartStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = FIELDS;
  protected readonly stateLabel = RESOLUTION_LABEL;
  protected readonly fullDate = fullDate;

  protected readonly query = signal('');
  protected readonly onlyOpen = signal(false);
  protected readonly editing = signal<Resolution | null>(null);
  protected readonly toDelete = signal<Resolution | null>(null);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .sortedResolutions()
      .filter((entry) => !this.onlyOpen() || isOpen(entry))
      .filter(
        (entry) =>
          !query ||
          `${entry.number} ${entry.title} ${entry.who.join(' ')} ${entry.text}`
            .toLocaleLowerCase('de')
            .includes(query),
      );
  });

  protected late(entry: Resolution): boolean {
    return isOverdue(entry, this.store.today);
  }

  protected subline(entry: Resolution): string {
    return [
      entry.date && `Beschluss vom ${fullDate(entry.date)}`,
      entry.who.length > 0 && `zuständig: ${entry.who.join(', ')}`,
      entry.due && `Frist ${fullDate(entry.due)}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected add(): void {
    this.editing.set(emptyResolution(this.store.today));
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.saveResolution({
      ...current,
      title: textOf(values, 'title'),
      number: textOf(values, 'number'),
      date: textOf(values, 'date'),
      who: listOf(values, 'who'),
      due: textOf(values, 'due'),
      state: resolutionStateOf(textOf(values, 'state')),
      text: textOf(values, 'text'),
    });
    this.toasts.saved(current.id ? 'Beschluss gespeichert' : 'Beschluss angelegt');
    this.editing.set(null);
  }

  protected markDone(entry: Resolution): void {
    this.store.markDone(entry.id);
    this.toasts.saved('Als erledigt eingetragen');
  }

  /** Puts the decision on the task board for the people who are responsible. */
  protected createTask(entry: Resolution): void {
    this.tasks.save({
      ...emptyTask(this.start.userName()),
      title: entry.title,
      text: [`Vorstandsbeschluss ${entry.number}`, entry.text].filter(Boolean).join('\n\n'),
      who: entry.who,
      due: entry.due,
      link: '/vorstand',
    });
    this.store.markTaskCreated(entry.id);
    this.toasts.saved('Aufgabe angelegt');
  }

  protected confirmDelete(): void {
    const entry = this.toDelete();
    if (entry) {
      this.store.removeResolution(entry.id);
      this.toasts.saved('Beschluss gelöscht');
    }
    this.toDelete.set(null);
  }

  protected exportExcel(): void {
    downloadXlsx('Beschlussliste.xlsx', resolutionsBook(this.visible(), this.store.today));
  }
}
