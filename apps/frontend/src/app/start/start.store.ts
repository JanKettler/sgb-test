import { Injectable, computed, inject } from '@angular/core';
import { CompetitionStore } from '../competition/competition.store';
import { dateOf } from '../competition/competition.models';
import { EventsStore } from '../events/events.store';
import { parseIsoDate } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { ClubEvent, Competition } from './start.models';

/** The first names shown in the greeting and used for "my tasks"; the demo has no real login. */
const DEMO_NAMES = { admin: 'Maria', trainer: 'Jonas', parent: 'Sabine' } as const;

/** In-memory stand-in for the meets, events and tasks that the start page reads. All data is invented. */
@Injectable({ providedIn: 'root' })
export class StartStore {
  private readonly training = inject(TrainingStore);
  private readonly meets = inject(CompetitionStore);
  private readonly plans = inject(EventsStore);
  readonly today = this.training.today;

  readonly userName = computed(() => DEMO_NAMES[this.training.role()]);
  /** Tasks and meets are shown to everybody who manages the club side; parents only see the calendar. */
  readonly canSeeClub = this.training.canManage;
  readonly canSeeAllTasks = this.training.isAdmin;

  /** The meets of the competition module, in the short form the start page shows. */
  readonly competitions = computed<Competition[]>(() =>
    this.meets.competitions().map((meet) => ({
      id: meet.id,
      title: meet.title,
      date: dateOf(meet),
      place: meet.place,
      internalDeadline: meet.internalDeadline,
      deadline: meet.deadline,
      entriesSent: meet.sent,
    })),
  );
  /** The events of the events page, as the start page shows them. */
  readonly events = computed<ClubEvent[]>(() =>
    this.plans
      .events()
      .filter((plan) => plan.date !== '' && plan.state !== 'Abgeschlossen')
      .map((plan) => ({
        id: plan.id,
        title: plan.title,
        date: plan.date,
        info: [plan.time ? `${plan.time} Uhr` : '', plan.place].filter(Boolean).join(', '),
        icon: plan.title.toLocaleLowerCase('de').includes('markt') ? 'tree' : 'calendar',
        route: '/veranstaltungen',
      })),
  );

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
}
