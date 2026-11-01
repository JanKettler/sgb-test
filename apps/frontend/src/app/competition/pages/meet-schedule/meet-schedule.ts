import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { Toasts } from '../../../ui/toast';
import { CompSection, showTime } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { downloadXlsx, printHtml } from '../../competition-download';
import {
  ListLine,
  bySwimmer,
  byTime,
  listFileName,
  listLines,
  overviewPage,
  sectionTimes,
  slipsBook,
  slipsPage,
  startListBook,
  startListPage,
} from '../../meet-lists';
import { readPdfLines } from '../../pdf-text';
import { parseMeldeergebnis } from '../../wk-parse';

type ListId = 'start' | 'event' | 'swimmer' | 'overview';

/** Meldeergebnis of one meet: who swims when and where, the lists for the pool deck, the judges. */
@Component({
  selector: 'app-meet-schedule',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meet-schedule.html',
  styleUrl: './meet-schedule.scss',
})
export class MeetSchedule {
  protected readonly store = inject(CompetitionStore);
  private readonly toasts = inject(Toasts);
  readonly id = input.required<string>();
  protected readonly clubName = this.store.club.name;
  protected readonly people = this.store.staffCandidates();
  protected readonly message = signal('');
  protected readonly failed = signal(false);
  protected readonly view = signal<'swimmer' | 'time'>('swimmer');
  protected readonly query = signal('');
  protected readonly competition = computed(() => this.store.competition(this.id()));

  protected readonly lists: readonly { id: ListId; label: string; excel: boolean }[] = [
    { id: 'start', label: 'Startliste (nach Uhrzeit)', excel: true },
    { id: 'event', label: 'Laufzettel nach Wettkampffolge', excel: true },
    { id: 'swimmer', label: 'Laufzettel nach Schwimmern', excel: true },
    { id: 'overview', label: 'Übersicht je Schwimmer', excel: false },
  ];

  protected readonly lines = computed(() => {
    const item = this.competition();
    return item ? listLines(item) : [];
  });

  protected readonly stand = computed(() => {
    const stand = this.competition()?.schedule.stand ?? '';
    const [date, time] = stand.split(' ');
    return `${date.split('-').reverse().join('.')} ${time ?? ''}`.trim();
  });

  protected readonly hasResults = computed(() => {
    const results = this.competition()?.schedule.results ?? {};
    return Object.values(results).some((result) => result.t || result.status);
  });

  /** One entry per swimmer (and year), by name, with the starts in the order of the day. */
  protected readonly swimmers = computed(() => {
    const query = this.query().trim().toLowerCase();
    const map = new Map<string, { key: string; name: string; year: string; lines: ListLine[] }>();
    for (const line of bySwimmer(this.lines())) {
      const key = `${line.start.n}|${line.year}`;
      const entry = map.get(key) ?? { key, name: line.swimmer, year: line.year, lines: [] };
      entry.lines.push(line);
      map.set(key, entry);
    }
    return [...map.values()].filter((entry) => !query || entry.name.toLowerCase().includes(query));
  });

  /** The starts in the order of the day, one block per section. */
  protected readonly timeGroups = computed(() => {
    const lines = byTime(this.lines());
    return [...new Set(lines.map((line) => line.section))].map((section) => ({
      section,
      lines: lines.filter((line) => line.section === section),
    }));
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected resultOf(line: ListLine): string {
    const result = this.competition()?.schedule.results[line.key];
    if (!result) return '';
    if (result.status) return result.status;
    const time = showTime(result.t);
    return result.place ? `${time} (${result.place}.)` : time;
  }

  /** "Einlass 09:00 · Einschwimmen 09:15 · Beginn 10:00" for a section; empty without times. */
  protected sectionInfo(section: CompSection): string {
    return sectionTimes(section).join(' · ');
  }

  protected isOpen(name: string): boolean {
    return !name || /^N\s?N$/i.test(name);
  }

  protected known(name: string): boolean {
    return this.people.some((person) => person.name === name);
  }

  protected assign(index: number, event: Event): void {
    this.store.assignDuty(this.id(), index, (event.target as HTMLSelectElement).value);
  }

  protected excel(list: ListId): void {
    const item = this.competition();
    if (!item || list === 'overview') return;
    if (list === 'start') downloadXlsx(listFileName('Startliste', item), startListBook(item));
    else {
      downloadXlsx(
        listFileName(list === 'event' ? 'Laufzettel' : 'Laufzettel_Schwimmer', item),
        slipsBook(item, list),
      );
    }
  }

  protected print(list: ListId): void {
    const item = this.competition();
    if (!item) return;
    const page =
      list === 'start'
        ? startListPage(item)
        : list === 'overview'
          ? overviewPage(item)
          : slipsPage(item, list);
    printHtml(page.title, page.body, { landscape: page.landscape, css: page.css });
  }

  protected async read(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.failed.set(false);
    this.message.set('Wird gelesen … (beim ersten Mal wird der PDF-Leser geladen)');
    try {
      const parsed = parseMeldeergebnis(await readPdfLines(file), this.clubName);
      if (parsed.starts.length === 0 && parsed.duties.length === 0) {
        this.failed.set(true);
        this.message.set(parsed.warnings.join(' '));
        return;
      }
      this.store.importSchedule(this.id(), parsed);
      this.message.set(
        `${parsed.starts.length} Starts und ${parsed.duties.length} Kampfgericht-Plätze übernommen.`,
      );
      this.toasts.show('Meldeergebnis übernommen', 'info');
    } catch (error) {
      this.failed.set(true);
      this.message.set(
        error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.',
      );
    }
  }
}
