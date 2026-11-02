import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { printHtml } from '../../competition/competition-download';
import { StartStore } from '../../start/start.store';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { SearchField } from '../../ui/search-field';
import { Toasts } from '../../ui/toast';
import { MOTION_STATES, Motion, emptyMotion, motionStateOf } from '../executive-board.models';
import { motionHtml } from '../executive-board.print';
import { ExecutiveBoardStore } from '../executive-board.store';
import { OutlineView } from '../outline-view';

const STATE_OPTIONS = MOTION_STATES.map((state) => ({ value: state, label: state }));

/** The motions to the board; every motion can be printed in the letterhead of the club. */
@Component({
  selector: 'app-board-motions',
  imports: [Action, FormDialog, ConfirmDialog, SearchField, OutlineView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motions-tab.html',
})
export class MotionsTab {
  protected readonly store = inject(ExecutiveBoardStore);
  private readonly start = inject(StartStore);
  private readonly toasts = inject(Toasts);

  protected readonly query = signal('');
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly editing = signal<Motion | null>(null);
  protected readonly toDelete = signal<Motion | null>(null);

  protected readonly fields = computed<FieldDef[]>(() => [
    { key: 'title', label: 'Antrag (Zeile 2 im Briefkopf)', required: true },
    { key: 'subtitle', label: 'Zusatz (Zeile 3 im Briefkopf)' },
    { key: 'heading', label: 'Überschrift im Text', type: 'textarea', rows: 2 },
    { key: 'date', label: 'Datum', type: 'date' },
    {
      key: 'author',
      label: 'Antragsteller',
      required: true,
      suggestions: this.store.memberNames(),
    },
    { key: 'state', label: 'Stand', type: 'select', options: STATE_OPTIONS },
    {
      key: 'text',
      label: 'Text',
      type: 'textarea',
      rows: 8,
      hint: 'Eine Leerzeile beginnt einen neuen Absatz. Zeilen mit „|“ bilden eine Tabelle, die erste Zeile ist die Kopfzeile. Anrede und Gruß werden beim Druck ergänzt.',
    },
    { key: 'decision', label: 'Beschluss oder Beschlussvorschlag', type: 'textarea', rows: 2 },
  ]);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .sortedMotions()
      .filter(
        (motion) =>
          !query ||
          `${motion.title} ${motion.subtitle} ${motion.heading} ${motion.author} ${motion.text}`
            .toLocaleLowerCase('de')
            .includes(query),
      );
  });

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

  protected subline(motion: Motion): string {
    return [motion.date && fullDate(motion.date), motion.author, motion.subtitle]
      .filter(Boolean)
      .join(' · ');
  }

  protected add(): void {
    this.editing.set(emptyMotion(this.store.today, this.start.userName()));
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.saveMotion({
      ...current,
      title: textOf(values, 'title'),
      subtitle: textOf(values, 'subtitle'),
      heading: textOf(values, 'heading'),
      date: textOf(values, 'date'),
      author: textOf(values, 'author'),
      state: motionStateOf(textOf(values, 'state')),
      text: textOf(values, 'text'),
      decision: textOf(values, 'decision'),
    });
    this.toasts.saved(current.id ? 'Antrag gespeichert' : 'Antrag angelegt');
    this.editing.set(null);
  }

  protected print(motion: Motion): void {
    printHtml(motion.title, motionHtml(motion));
  }

  protected makeResolution(motion: Motion): void {
    if (this.store.resolutionFromMotion(motion.id)) {
      this.toasts.saved('Beschluss angelegt, siehe Reiter „Beschlüsse“');
    } else {
      this.toasts.failed('Zu diesem Antrag gibt es schon einen Beschluss');
    }
  }

  protected confirmDelete(): void {
    const motion = this.toDelete();
    if (motion) {
      this.store.removeMotion(motion.id);
      this.toasts.saved('Antrag gelöscht');
    }
    this.toDelete.set(null);
  }
}
