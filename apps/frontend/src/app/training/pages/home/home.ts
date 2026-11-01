import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../ui/icon';
import { addDays, endTime, minutesOfDay, parseIsoDate, weekdayShort } from '../../training-dates';
import { TrainingStore } from '../../training.store';

const HOUR_HEIGHT = 40;
const FALLBACK_HOURS = [17, 21] as const;

interface CalendarEvent {
  id: string;
  groupClass: string;
  title: string;
  time: string;
  detail: string;
  top: number;
  height: number;
}

interface CalendarDay {
  iso: string;
  weekday: string;
  label: string;
  isToday: boolean;
  events: CalendarEvent[];
}

/** Start page: the next seven days. The hour range follows the sessions that are shown. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly store = inject(TrainingStore);
  protected readonly role = this.store.role;
  protected readonly hourHeight = HOUR_HEIGHT;

  private readonly entries = computed(() => this.store.weekEntries());

  protected readonly hours = computed(() => {
    const sessions = this.entries().map((entry) => entry.session);
    let first: number = FALLBACK_HOURS[0];
    let last: number = FALLBACK_HOURS[1];
    if (sessions.length > 0) {
      first = Math.min(...sessions.map((s) => Math.floor(minutesOfDay(s.time) / 60)));
      last = Math.max(
        ...sessions.map((s) => Math.ceil(minutesOfDay(endTime(s.time, s.durationMinutes)) / 60)),
      );
    }
    return Array.from({ length: Math.max(last - first, 1) }, (_, index) => first + index);
  });

  protected readonly bodyHeight = computed(() => this.hours().length * HOUR_HEIGHT);

  protected readonly days = computed<CalendarDay[]>(() => {
    const firstMinute = this.hours()[0] * 60;
    const sinceMonday = (parseIsoDate(this.store.today).getDay() + 6) % 7;
    const monday = addDays(this.store.today, -sinceMonday);
    return Array.from({ length: 7 }, (_, offset) => {
      const iso = addDays(monday, offset);
      const events = this.entries()
        .filter((entry) => entry.session.date === iso)
        .map(({ session, labels }): CalendarEvent => {
          return {
            id: session.id,
            groupClass: `grp-${session.groupIds[0]}`,
            title: this.store.groupNames(session),
            time: `${session.time}–${endTime(session.time, session.durationMinutes)} Uhr`,
            detail: labels.length > 0 ? labels.join(', ') : this.store.venueName(session.venueId),
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
      };
    });
  });
}
