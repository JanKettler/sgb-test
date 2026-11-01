import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { addDays } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import {
  Meeting,
  Motion,
  Resolution,
  emptyResolution,
  isOpen,
  isOverdue,
} from './executive-board.models';
import { minutesFromAgenda } from './outline';

/** A line of the deadline calendar: an open decision or a meeting that is planned. */
export interface Deadline {
  id: string;
  kind: 'resolution' | 'meeting';
  title: string;
  who: string;
  date: string;
  days: number;
  overdue: boolean;
}

function newestFirst<T extends { date: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date);
}

/** In-memory stand-in for the future board API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class ExecutiveBoardStore {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  private counter = 100;
  readonly today = this.training.today;

  /** Only the board sees and changes motions, minutes and decisions. */
  readonly canEdit = this.training.isAdmin;
  readonly memberNames = this.people.memberNames;

  readonly motions = signal<Motion[]>(this.sampleMotions());
  readonly meetings = signal<Meeting[]>(this.sampleMeetings());
  readonly resolutions = signal<Resolution[]>(this.sampleResolutions());

  readonly sortedMotions = computed(() => [...this.motions()].sort(newestFirst));
  readonly sortedMeetings = computed(() => [...this.meetings()].sort(newestFirst));
  readonly sortedResolutions = computed(() => [...this.resolutions()].sort(newestFirst));
  readonly openCount = computed(() => this.resolutions().filter(isOpen).length);
  readonly overdueCount = computed(
    () => this.resolutions().filter((entry) => isOverdue(entry, this.today)).length,
  );

  readonly deadlines = computed<Deadline[]>(() => {
    const list: Deadline[] = [];
    for (const entry of this.resolutions()) {
      if (!isOpen(entry) || !entry.due) continue;
      list.push(
        this.deadline('resolution', entry.id, entry.title, entry.who.join(', '), entry.due),
      );
    }
    for (const meeting of this.meetings()) {
      if (meeting.state === 'Durchgeführt' || !meeting.date) continue;
      list.push(this.deadline('meeting', meeting.id, meeting.title, '', meeting.date));
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  });

  saveMotion(motion: Motion): void {
    this.save(this.motions, motion, 'a');
  }

  removeMotion(id: string): void {
    this.motions.update((list) => list.filter((entry) => entry.id !== id));
  }

  saveMeeting(meeting: Meeting): void {
    this.save(this.meetings, meeting, 's');
  }

  removeMeeting(id: string): void {
    this.meetings.update((list) => list.filter((entry) => entry.id !== id));
  }

  /** Starts the minutes with the points of the agenda, so only the content has to be added. */
  prepareMinutes(id: string): void {
    this.meetings.update((list) =>
      list.map((entry) =>
        entry.id === id && !entry.minutes
          ? { ...entry, minutes: minutesFromAgenda(entry.agenda) }
          : entry,
      ),
    );
  }

  saveResolution(resolution: Resolution): void {
    this.save(
      this.resolutions,
      resolution.number ? resolution : { ...resolution, number: this.nextNumber() },
      'b',
    );
  }

  /** The next free number of a decision in this year, e.g. "2026/13". */
  nextNumber(): string {
    const year = this.today.slice(0, 4);
    const used = this.resolutions()
      .filter((entry) => entry.number.startsWith(`${year}/`))
      .map((entry) => Number(entry.number.slice(5)))
      .filter((value) => Number.isFinite(value));
    return `${year}/${String(Math.max(0, ...used) + 1).padStart(2, '0')}`;
  }

  removeResolution(id: string): void {
    this.resolutions.update((list) => list.filter((entry) => entry.id !== id));
  }

  markDone(id: string): void {
    this.patchResolution(id, { state: 'done' });
  }

  markTaskCreated(id: string): void {
    this.patchResolution(id, { taskCreated: true });
  }

  /** Makes a decision out of a motion that was passed; returns false if there is one already. */
  resolutionFromMotion(motionId: string): boolean {
    const motion = this.motions().find((entry) => entry.id === motionId);
    if (!motion || this.resolutions().some((entry) => entry.motionId === motionId)) return false;
    this.saveResolution({
      ...emptyResolution(this.today),
      title: motion.title,
      text: motion.decision || motion.text,
      motionId,
    });
    return true;
  }

  hasResolution(motionId: string): boolean {
    return this.resolutions().some((entry) => entry.motionId === motionId);
  }

  private deadline(
    kind: Deadline['kind'],
    id: string,
    title: string,
    who: string,
    date: string,
  ): Deadline {
    const days = Math.round(
      (Date.parse(`${date}T12:00:00`) - Date.parse(`${this.today}T12:00:00`)) / 86_400_000,
    );
    return { id, kind, title, who, date, days, overdue: days < 0 };
  }

  private patchResolution(id: string, change: Partial<Resolution>): void {
    this.resolutions.update((list) =>
      list.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );
  }

  private save<T extends { id: string }>(
    target: WritableSignal<T[]>,
    item: T,
    prefix: string,
  ): void {
    if (!item.id) {
      target.update((list) => [...list, { ...item, id: `${prefix}-${++this.counter}` }]);
      return;
    }
    target.update((list) => list.map((entry) => (entry.id === item.id ? item : entry)));
  }

  private sampleMotions(): Motion[] {
    const day = (offset: number) => addDays(this.today, offset);
    return [
      {
        id: 'a-1',
        title: 'Antrag Kostenübernahme Wettkampftraining',
        subtitle: 'Hallenbad',
        heading: 'Zusätzliche Wasserzeit für die Wettkampfgruppe',
        date: day(-12),
        author: 'Anna Brandt',
        state: 'Eingereicht',
        text:
          'wir bitten den Vorstand, die Kosten für eine zusätzliche Bahn pro Woche zu übernehmen.' +
          '\n\n| Posten | Einzelpreis | Summe |\n| Bahnmiete pro Stunde | 18,00 € | 72,00 € |',
        decision: '',
      },
      {
        id: 'a-2',
        title: 'Antrag Trikots für die Wettkampfgruppe',
        subtitle: '',
        heading: '',
        date: day(-70),
        author: 'Jonas Weber',
        state: 'Beschlossen',
        text: 'Die Wettkampfgruppe braucht neue Vereinstrikots.',
        decision: 'Der Vorstand beschließt die Anschaffung von 20 Trikots.',
      },
    ];
  }

  private sampleMeetings(): Meeting[] {
    const day = (offset: number) => addDays(this.today, offset);
    return [
      {
        id: 's-1',
        title: 'Vorstandssitzung',
        date: day(9),
        time: '19:30',
        place: 'Vereinsheim',
        state: 'Geplant',
        agenda: ['Begrüßung', 'Weihnachtsmarkt', 'Hallenzeiten', 'Verschiedenes'],
        attendees: '',
        secretary: '',
        minutes: '',
      },
      {
        id: 's-2',
        title: 'Vorstandssitzung',
        date: day(-35),
        time: '19:30',
        place: 'Vereinsheim',
        state: 'Durchgeführt',
        agenda: ['Begrüßung', 'Beschlüsse', 'Verschiedenes'],
        attendees: 'Maria (1. Vorsitz), Anna (Kasse), Jonas (Sport)',
        secretary: 'Anna Brandt',
        minutes:
          'Begrüßung\nBeschlüsse\n- Trikots: [Jonas] holt drei Angebote ein\n- Hallenzeiten werden verlängert\n' +
          '| Angebot | Preis |\n| A | 480 € |\n| B | 520 € |\nVerschiedenes\n',
      },
    ];
  }

  private sampleResolutions(): Resolution[] {
    const day = (offset: number) => addDays(this.today, offset);
    const base = emptyResolution(this.today);
    const year = this.today.slice(0, 4);
    return [
      {
        ...base,
        id: 'b-1',
        number: `${year}/11`,
        title: 'Trikots für die Wettkampfgruppe bestellen',
        date: day(-30),
        who: ['Jonas'],
        due: day(-3),
        state: 'working',
        text: 'Drei Angebote einholen, dann bestellen.',
        motionId: 'a-2',
      },
      {
        ...base,
        id: 'b-2',
        number: `${year}/12`,
        title: 'Hallenzeiten im Winter verlängern',
        date: day(-30),
        who: ['Maria', 'Anna'],
        due: day(20),
        text: 'Beim Betreiber anfragen.',
      },
      {
        ...base,
        id: 'b-3',
        number: `${year}/09`,
        title: 'Beitragsordnung anpassen',
        date: day(-90),
        who: ['Anna'],
        due: day(-60),
        state: 'done',
      },
    ];
  }
}
