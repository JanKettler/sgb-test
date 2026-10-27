import { Component, computed, inject } from '@angular/core';
import { addDays, endTime, minutesOfDay, parseIsoDate, weekdayShort } from './training-dates';
import { TrainingStore } from './training.store';

interface CalendarDay {
  iso: string;
  weekday: string;
  dayOfMonth: string;
  isToday: boolean;
  events: CalendarEvent[];
}

interface CalendarEvent {
  id: string;
  groupClass: string;
  time: string;
  title: string;
  detail: string;
  top: number;
  height: number;
}

const HOUR_HEIGHT = 56;

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
})
export class Home {
  protected readonly store = inject(TrainingStore);
  protected readonly hourHeight = HOUR_HEIGHT;

  private readonly entries = computed(() => this.store.weekEntries());

  protected readonly hours = computed(() => {
    const sessions = this.entries().map((entry) => entry.session);
    const first = Math.min(17, ...sessions.map((s) => Math.floor(minutesOfDay(s.time) / 60)));
    const last = Math.max(
      21,
      ...sessions.map((s) => Math.ceil(minutesOfDay(endTime(s.time, s.durationMinutes)) / 60)),
    );
    const hours: number[] = [];
    for (let hour = first; hour < last; hour++) hours.push(hour);
    return hours;
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const firstHour = this.hours()[0];
    return Array.from({ length: 7 }, (_, offset) => {
      const iso = addDays(this.store.today, offset);
      const events = this.entries()
        .filter((entry) => entry.session.date === iso)
        .map(({ session, labels }): CalendarEvent => {
          const minutes = minutesOfDay(session.time) - firstHour * 60;
          return {
            id: session.id,
            groupClass: `grp-${session.groupIds[0]}`,
            time: `${session.time}–${endTime(session.time, session.durationMinutes)}`,
            title: session.groupIds.map((id) => this.store.groupName(id)).join(' + '),
            detail: labels.length > 0 ? labels.join(', ') : this.store.venueName(session.venueId),
            top: (minutes / 60) * HOUR_HEIGHT,
            height: Math.max((session.durationMinutes / 60) * HOUR_HEIGHT - 2, 24),
          };
        });
      return {
        iso,
        weekday: weekdayShort(iso),
        dayOfMonth: String(parseIsoDate(iso).getDate()),
        isToday: offset === 0,
        events,
      };
    });
  });

  protected readonly bodyHeight = computed(() => this.hours().length * HOUR_HEIGHT);
}
