import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { printHtml } from '../../competition/competition-download';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, listOf, textOf } from '../../ui/form-dialog';
import { SearchField } from '../../ui/search-field';
import { Toasts } from '../../ui/toast';
import { MEETING_STATES, Meeting, emptyMeeting, meetingStateOf } from '../executive-board.models';
import { minutesHtml } from '../executive-board.print';
import { ExecutiveBoardStore } from '../executive-board.store';
import { OutlineView } from '../outline-view';

const STATE_OPTIONS = MEETING_STATES.map((state) => ({ value: state, label: state }));

/** The meetings of the board with agenda and minutes. */
@Component({
  selector: 'app-board-meetings',
  imports: [Action, FormDialog, ConfirmDialog, SearchField, OutlineView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meetings-tab.html',
})
export class MeetingsTab {
  protected readonly store = inject(ExecutiveBoardStore);
  private readonly toasts = inject(Toasts);

  protected readonly query = signal('');
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly editing = signal<Meeting | null>(null);
  protected readonly toDelete = signal<Meeting | null>(null);

  protected readonly fields = computed<FieldDef[]>(() => [
    { key: 'title', label: 'Titel', required: true },
    { key: 'date', label: 'Datum', type: 'date', required: true },
    { key: 'time', label: 'Uhrzeit', type: 'time' },
    { key: 'place', label: 'Ort' },
    { key: 'state', label: 'Stand', type: 'select', options: STATE_OPTIONS },
    {
      key: 'agenda',
      label: 'Tagesordnung',
      type: 'lines',
      rows: 5,
      hint: 'Pro Zeile ein Punkt.',
    },
    { key: 'attendees', label: 'Anwesend', type: 'textarea', rows: 2 },
    { key: 'secretary', label: 'Protokollführung', suggestions: this.store.memberNames() },
    {
      key: 'minutes',
      label: 'Protokoll',
      type: 'textarea',
      rows: 10,
      hint: 'Jede Zeile ist ein Punkt und wird automatisch nummeriert. „- “ am Anfang macht einen Unterpunkt, „-- “ einen Punkt darunter. Zeilen mit „|“ bilden eine Tabelle. Namen in [eckigen Klammern] werden hervorgehoben.',
    },
  ]);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .sortedMeetings()
      .filter(
        (meeting) =>
          !query ||
          `${meeting.title} ${meeting.place} ${meeting.agenda.join(' ')} ${meeting.minutes}`
            .toLocaleLowerCase('de')
            .includes(query),
      );
  });

  /** The name that tells two meetings with the same title apart. */
  protected nameOf(meeting: Meeting): string {
    return meeting.date ? `${meeting.title} vom ${fullDate(meeting.date)}` : meeting.title;
  }

  protected subline(meeting: Meeting): string {
    const when = [meeting.date && fullDate(meeting.date), meeting.time && `${meeting.time} Uhr`];
    return [when.filter(Boolean).join(', '), meeting.place].filter(Boolean).join(' · ');
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

  protected add(): void {
    this.editing.set(emptyMeeting(this.store.today));
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.saveMeeting({
      ...current,
      title: textOf(values, 'title'),
      date: textOf(values, 'date'),
      time: textOf(values, 'time'),
      place: textOf(values, 'place'),
      state: meetingStateOf(textOf(values, 'state')),
      agenda: listOf(values, 'agenda'),
      attendees: textOf(values, 'attendees'),
      secretary: textOf(values, 'secretary'),
      minutes: textOf(values, 'minutes'),
    });
    this.toasts.saved(current.id ? 'Sitzung gespeichert' : 'Sitzung angelegt');
    this.editing.set(null);
  }

  /** Starts the minutes with the points of the agenda and opens the meeting. */
  protected prepareMinutes(meeting: Meeting): void {
    this.store.prepareMinutes(meeting.id);
    this.opened.update((set) => new Set(set).add(meeting.id));
    this.toasts.saved('Protokoll mit der Tagesordnung begonnen');
  }

  protected print(meeting: Meeting): void {
    printHtml(`Protokoll ${meeting.title}`, minutesHtml(meeting));
  }

  protected confirmDelete(): void {
    const meeting = this.toDelete();
    if (meeting) {
      this.store.removeMeeting(meeting.id);
      this.toasts.saved('Sitzung gelöscht');
    }
    this.toDelete.set(null);
  }
}
