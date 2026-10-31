import { Injectable, computed, inject, signal } from '@angular/core';
import { addDays, parseIsoDate } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { ClubEvent, Competition } from './start.models';

/** The first names shown in the greeting and used for "my tasks"; the demo has no real login. */
const DEMO_NAMES = { admin: 'Maria', trainer: 'Jonas', parent: 'Sabine' } as const;

/** In-memory stand-in for the meets, events and tasks that the start page reads. All data is invented. */
@Injectable({ providedIn: 'root' })
export class StartStore {
  private readonly training = inject(TrainingStore);
  readonly today = this.training.today;

  readonly userName = computed(() => DEMO_NAMES[this.training.role()]);
  /** Tasks and meets are shown to everybody who manages the club side; parents only see the calendar. */
  readonly canSeeClub = this.training.canManage;
  readonly canSeeAllTasks = this.training.isAdmin;

  readonly competitions = signal<Competition[]>(this.sampleCompetitions());
  readonly events = signal<ClubEvent[]>(this.sampleEvents());

  readonly upcomingCompetitions = computed(() =>
    this.competitions()
      .filter((competition) => competition.date >= this.today)
      .sort((a, b) => a.date.localeCompare(b.date)),
  );

  daysTo(iso: string): number {
    return Math.round(
      (parseIsoDate(iso).getTime() - parseIsoDate(this.today).getTime()) / (24 * 60 * 60 * 1000),
    );
  }

  private sampleCompetitions(): Competition[] {
    const day = (offset: number) => addDays(this.today, offset);
    return [
      {
        id: 'c-1',
        title: 'Hunte-Pokal',
        date: day(16),
        place: 'Hallenbad Oldenburg',
        internalDeadline: day(2),
        deadline: day(6),
        entriesSent: false,
        starters: [
          { name: 'Lena Brandt', starts: 3 },
          { name: 'Mats Hoffmann', starts: 2 },
          { name: 'Nele Sommer', starts: 4 },
          { name: 'Tim Wagner', starts: 2 },
          { name: 'Ida Krüger', starts: 3 },
        ],
      },
      {
        id: 'c-2',
        title: 'Nikolausschwimmen',
        date: day(40),
        place: 'Freizeitbad Hunteholz',
        internalDeadline: day(24),
        deadline: day(28),
        entriesSent: false,
        starters: [],
      },
      {
        id: 'c-3',
        title: 'Bezirksmeisterschaften',
        date: day(75),
        place: 'Sportbad Bremen',
        internalDeadline: day(55),
        deadline: day(60),
        entriesSent: false,
        starters: [],
      },
    ];
  }

  private sampleEvents(): ClubEvent[] {
    return [
      {
        id: 'e-1',
        title: 'Weihnachtsmarkt',
        date: addDays(this.today, 30),
        info: 'Stand am Marktplatz',
        icon: 'tree',
      },
      {
        id: 'e-2',
        title: 'Jahreshauptversammlung',
        date: addDays(this.today, 52),
        info: 'Vereinsheim, 19 Uhr',
        icon: 'calendar',
      },
    ];
  }
}
