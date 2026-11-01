import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateOf } from '../../../competition/competition.models';
import { CompetitionStore } from '../../../competition/competition.store';
import { StartStore } from '../../../start/start.store';
import { Icon, IconName } from '../../../ui/icon';
import { addDays, endTime, minutesOfDay, parseIsoDate, weekdayShort } from '../../training-dates';
import { TrainingStore } from '../../training.store';

const HOUR_HEIGHT = 40;
/** Height of one line in the all-day strip, in rem. */
const ALLDAY_LINE_REM = 1.5;
const FALLBACK_HOURS = [17, 21] as const;

interface CalendarEvent {
  id: string;
  groupClass: string;
  title: string;
  time: string;
  top: number;
  height: number;
}

/** A meet or club event that lasts the whole day; shown in a strip below the day header. */
interface AllDayItem {
  key: string;
  title: string;
  icon: IconName;
  kind: 'meet' | 'event';
  route: string;
}

interface CalendarDay {
  iso: string;
  weekday: string;
  label: string;
  isToday: boolean;
  events: CalendarEvent[];
  allDay: AllDayItem[];
}

/** Start page: the current week. The hour range follows the sessions that are shown. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly store = inject(TrainingStore);
  private readonly meets = inject(CompetitionStore);
  private readonly start = inject(StartStore);
  protected readonly role = this.store.role;
  protected readonly hourHeight = HOUR_HEIGHT;
  protected readonly lineRem = ALLDAY_LINE_REM;

  /** 0 = current week, -1 = last week, 1 = next week, ... */
  protected readonly weekOffset = signal(0);

  private readonly entries = computed(() => this.store.weekEntries(this.weekOffset()));

  protected readonly hours = computed(() => {
    const sessions = this.entries().map((entry) => entry.session);
    let first: number = FALLBACK_HOURS[0];
    let last: number = FALLBACK_HOURS[1];
    if (sessions.length > 0) {
      // Half an hour before and after the sessions of the week.
      first = Math.max(
        0,
        Math.min(...sessions.map((s) => Math.floor((minutesOfDay(s.time) - 30) / 60))),
      );
      last = Math.min(
        24,
        Math.max(
          ...sessions.map((s) =>
            Math.ceil((minutesOfDay(endTime(s.time, s.durationMinutes)) + 30) / 60),
          ),
        ),
      );
    }
    return Array.from({ length: Math.max(last - first, 1) }, (_, index) => first + index);
  });

  protected readonly weekLabel = computed(() => {
    const days = this.days();
    return `${days[0].label} – ${days[6].label}`;
  });

  protected shiftWeek(step: number): void {
    this.weekOffset.update((offset) => offset + step);
  }

  protected readonly bodyHeight = computed(() => this.hours().length * HOUR_HEIGHT);

  /** Meets and club events by day, for the strip below the day headers. */
  private readonly allDayByDate = computed(() => {
    const byDate = new Map<string, AllDayItem[]>();
    const add = (iso: string, item: AllDayItem) =>
      byDate.set(iso, [...(byDate.get(iso) ?? []), item]);
    for (const meet of this.meets.calendarMeets()) {
      const dates = meet.sections.map((section) => section.date).filter(Boolean);
      for (const iso of new Set(dates.length > 0 ? dates : [dateOf(meet)])) {
        add(iso, {
          key: `${meet.id}-${iso}`,
          title: meet.title,
          icon: 'flag',
          kind: 'meet',
          route: `/wettkampf/wettkaempfe/${meet.id}`,
        });
      }
    }
    for (const event of this.start.events()) {
      add(event.date, {
        key: event.id,
        title: event.title,
        icon: event.icon,
        kind: 'event',
        route: '/',
      });
    }
    return byDate;
  });

  /** Height of the all-day strip: as many lines as the busiest day of the week needs. */
  protected readonly allDayLines = computed(() =>
    Math.max(0, ...this.days().map((day) => day.allDay.length)),
  );

  protected readonly days = computed<CalendarDay[]>(() => {
    const firstMinute = this.hours()[0] * 60;
    const sinceMonday = (parseIsoDate(this.store.today).getDay() + 6) % 7;
    const monday = addDays(this.store.today, -sinceMonday + this.weekOffset() * 7);
    return Array.from({ length: 7 }, (_, offset) => {
      const iso = addDays(monday, offset);
      const events = this.entries()
        .filter((entry) => entry.session.date === iso)
        .map(({ session }): CalendarEvent => {
          return {
            id: session.id,
            groupClass: `grp-${session.groupIds[0]}`,
            title: this.store.groupNames(session),
            time: `${session.time}–${endTime(session.time, session.durationMinutes)} Uhr`,
            top: ((minutesOfDay(session.time) - firstMinute) / 60) * HOUR_HEIGHT,
            height: Math.max((session.durationMinutes / 60) * HOUR_HEIGHT - 3, 24),
          };
        });
      const date = parseIsoDate(iso);
      return {
        iso,
        weekday: weekdayShort(iso).toUpperCase(),
        label: `${date.getDate()}.${date.getMonth() + 1}.`,
        isToday: iso === this.store.today,
        events,
        allDay: this.allDayByDate().get(iso) ?? [],
      };
    });
  });
}
