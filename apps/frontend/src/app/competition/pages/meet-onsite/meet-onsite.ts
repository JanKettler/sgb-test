import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import {
  NO_TIME,
  RunResult,
  RunStart,
  diffText,
  displayName,
  eventTitle,
  isRelayStart,
  isValidTime,
  maskTime,
  msToTime,
  showTime,
  splitCount,
  startKey,
  timeMs,
} from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { plainEventName } from '../../meet-lists';

interface StartRow {
  key: string;
  start: RunStart;
  section: number;
  event: string;
  result: RunResult | undefined;
  done: boolean;
  /** Intermediate times asked for (every 100 m from 200 m on). */
  splits: number[];
}

interface Watch {
  key: string;
  name: string;
  event: string;
  splits: number;
  running: boolean;
  startedAt: number;
  elapsed: number | null;
  laps: number[];
}

const STATUS = ['DQ', 'nicht angetreten', 'abgemeldet'];

/** 200 for "200m Brust"; relays ("4x50m Lagen") have no single distance. */
function distanceOf(name: string): number {
  if (/^\d+\s*x/i.test(name)) return 0;
  return Number(/(\d+)\s*m\b/i.exec(name)?.[1] ?? 0);
}

/**
 * The list for the pool deck: every start of the club in the order of the day with time of day,
 * heat and lane. Times are typed in as digits, intermediate times come with distances from 200 m,
 * and a stopwatch takes times straight from the starting block.
 */
@Component({
  selector: 'app-meet-onsite',
  imports: [Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meet-onsite.html',
  styleUrl: './meet-onsite.scss',
})
export class MeetOnsite {
  protected readonly store = inject(CompetitionStore);
  readonly id = input.required<string>();

  protected readonly competition = computed(() => this.store.competition(this.id()));
  protected readonly status = STATUS;
  protected readonly showTime = showTime;
  protected readonly swimmerKey = signal('');
  protected readonly onlyOpen = signal(false);
  /** Fields whose last input was no time ("01:75,00"); they are not saved. */
  protected readonly invalid = signal<ReadonlySet<string>>(new Set());

  protected readonly watch = signal<Watch | null>(null);
  protected readonly watchOpen = signal(false);
  protected readonly clock = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  protected readonly rows = computed<StartRow[]>(() => {
    const item = this.competition();
    if (!item) return [];
    return item.schedule.starts
      .map((start) => {
        const key = startKey(start);
        const result = item.schedule.results[key];
        const name = eventTitle(item, start.e);
        return {
          key,
          start,
          section: item.events.find((entry) => entry.no === start.e)?.section ?? 1,
          event: plainEventName(name),
          result,
          done: !!(result && (result.t || result.status || result.ok)),
          splits: Array.from(
            { length: splitCount(distanceOf(name), isRelayStart(start)) },
            (_, index) => index,
          ),
        };
      })
      .sort(
        (a, b) =>
          a.section - b.section ||
          a.start.e - b.start.e ||
          a.start.l - b.start.l ||
          a.start.b - b.start.b,
      );
  });

  protected readonly swimmers = computed(() => {
    const seen = new Map<string, string>();
    for (const row of this.rows()) {
      seen.set(`${row.start.n}|${row.start.j}`, displayName(row.start.n));
    }
    return [...seen]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  protected readonly groups = computed(() => {
    const swimmer = this.swimmerKey();
    const rows = this.rows().filter(
      (row) =>
        (!swimmer || `${row.start.n}|${row.start.j}` === swimmer) &&
        (!this.onlyOpen() || !row.done),
    );
    const sections = [...new Set(rows.map((row) => row.section))];
    return sections.map((section) => ({
      section,
      begin: this.competition()?.sections.find((entry) => entry.no === section),
      rows: rows.filter((row) => row.section === section),
    }));
  });

  protected readonly multi = computed(() => (this.competition()?.sections.length ?? 0) > 1);
  protected readonly doneCount = computed(() => this.rows().filter((row) => row.done).length);

  protected display = displayName;

  protected pick(event: Event): void {
    this.swimmerKey.set((event.target as HTMLSelectElement).value);
  }

  /** Marks a field as no time; returns true when the input is fine. */
  private check(id: string, valid: boolean): boolean {
    this.invalid.update((current) => {
      const next = new Set(current);
      if (valid) next.delete(id);
      else next.add(id);
      return next;
    });
    return valid;
  }

  /** The field only takes digits; colon and comma are set while typing. */
  protected typeEnd(row: StartRow, event: Event): void {
    const field = event.target as HTMLInputElement;
    const masked = maskTime(field.value);
    field.value = masked === NO_TIME ? '' : masked;
    if (!this.check(`${row.key}:t`, isValidTime(masked))) return;
    this.store.setResult(this.id(), row.key, { t: masked === NO_TIME ? '' : masked });
  }

  protected typeSplit(row: StartRow, index: number, event: Event): void {
    const field = event.target as HTMLInputElement;
    const masked = maskTime(field.value);
    field.value = masked === NO_TIME ? '' : masked;
    if (!this.check(`${row.key}:${index}`, isValidTime(masked))) return;
    const splits = [...(row.result?.sp ?? [])];
    while (splits.length <= index) splits.push('');
    splits[index] = masked === NO_TIME ? '' : masked;
    while (splits.length > 0 && !splits[splits.length - 1]) splits.pop();
    this.store.setResult(this.id(), row.key, { sp: splits });
  }

  protected setStatus(row: StartRow, event: Event): void {
    this.store.setResult(this.id(), row.key, {
      status: (event.target as HTMLSelectElement).value,
    });
  }

  protected toggleDone(row: StartRow): void {
    this.store.setResult(this.id(), row.key, { ok: !row.result?.ok });
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected setNote(event: Event): void {
    this.store.setNote(this.id(), (event.target as HTMLTextAreaElement).value);
  }

  /** How much slower or faster than the entry time; empty without both times. */
  protected diff(row: StartRow): { text: string; best: boolean } | null {
    if (!row.result || row.result.status || !row.result.t || !isValidTime(row.result.t))
      return null;
    const result = timeMs(row.result.t);
    const entry = timeMs(row.start.m);
    if (result === null || !entry) return null;
    return { text: diffText(result - entry), best: result < entry };
  }

  /** The time of each 100 m, from the intermediate times and the end time. */
  protected laps(row: StartRow): string {
    if (!row.result) return '';
    const times = [...row.result.sp.filter(Boolean), ...(row.result.t ? [row.result.t] : [])];
    let before = 0;
    const parts: string[] = [];
    for (const time of times) {
      const ms = timeMs(time);
      if (ms === null) continue;
      parts.push(showTime(msToTime(ms - before)));
      before = ms;
    }
    return parts.length > 1 ? parts.join(' · ') : '';
  }

  // ---- Stopwatch ----------------------------------------------------------------------------

  protected openWatch(row: StartRow): void {
    const current = this.watch();
    if (current?.key !== row.key) {
      this.stopTimer();
      this.watch.set({
        key: row.key,
        name: displayName(row.start.n),
        event: `Wk ${row.start.e} · ${row.event}`,
        splits: row.splits.length,
        running: false,
        startedAt: 0,
        elapsed: null,
        laps: [],
      });
      this.clock.set(0);
    }
    this.watchOpen.set(true);
  }

  protected go(): void {
    const current = this.watch();
    if (!current || current.running || current.elapsed !== null) return;
    const startedAt = Date.now();
    this.watch.set({ ...current, running: true, startedAt });
    this.timer = setInterval(() => this.clock.set(Date.now() - startedAt), 50);
  }

  protected lap(): void {
    const current = this.watch();
    if (!current?.running || current.laps.length >= current.splits) return;
    this.watch.set({ ...current, laps: [...current.laps, Date.now() - current.startedAt] });
  }

  protected stop(): void {
    const current = this.watch();
    if (!current?.running) return;
    const elapsed = Date.now() - current.startedAt;
    this.stopTimer();
    this.clock.set(elapsed);
    this.watch.set({ ...current, running: false, elapsed });
  }

  protected reset(): void {
    const current = this.watch();
    if (!current) return;
    this.stopTimer();
    this.clock.set(0);
    this.watch.set({ ...current, running: false, startedAt: 0, elapsed: null, laps: [] });
  }

  protected takeOver(): void {
    const current = this.watch();
    if (!current || current.elapsed === null) return;
    this.store.setResult(this.id(), current.key, {
      t: msToTime(current.elapsed),
      sp: current.laps.slice(0, current.splits).map(msToTime),
    });
    this.stopTimer();
    this.watch.set(null);
    this.watchOpen.set(false);
  }

  protected closeWatch(): void {
    this.watchOpen.set(false);
  }

  /** "1:38,52" or "31,20"; "0,00" at the start. */
  protected clockText(ms: number): string {
    return showTime(msToTime(ms)) || '0,00';
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
