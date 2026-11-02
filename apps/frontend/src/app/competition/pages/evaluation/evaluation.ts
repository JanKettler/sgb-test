import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Action } from '../../../ui/action';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { Toasts } from '../../../ui/toast';
import { downloadBytes } from '../../competition-download';
import { bandsToText, isDefaultBands, textToBands } from '../../evaluation/band-text';
import { EvaluationBlocks } from '../../evaluation/evaluation-blocks';
import {
  honourPage,
  memberBlocks,
  rankingBlocks,
  sheetBlocks,
  statBlocks,
} from '../../evaluation/evaluation.blocks';
import { longDate } from '../../evaluation/evaluation.logic';
import { BahnChoice, BandDef } from '../../evaluation/evaluation.model';
import { EvaluationStore } from '../../evaluation/evaluation.store';
import {
  XLSX_TYPE,
  createReportXlsx,
  evaluationFileName,
  evaluationSheets,
} from '../../evaluation/evaluation.xlsx';
import {
  COURSE_NAME,
  WaResult,
  WaSet,
  mergeWa,
  parseWaCsv,
  parseWaPdf,
  toWaSet,
} from '../../evaluation/wa-points';
import { WA_SAMPLE_FILE } from '../../evaluation/wa-sample';
import { readPdfLines, readTextFile } from '../../pdf-text';

type Tab = 'rank' | 'stat' | 'honour' | 'sheet' | 'upload';

const TABS: { id: Tab; label: string }[] = [
  { id: 'rank', label: 'Rangliste' },
  { id: 'stat', label: 'Statistik' },
  { id: 'honour', label: 'Ehrungen' },
  { id: 'sheet', label: 'Einzelblatt' },
  { id: 'upload', label: 'Hochladen' },
];

/** Base times read from files, waiting for a look before they are stored. */
interface WaPreview {
  result: WaResult;
  file: string;
}

interface BandsForm {
  masters: string;
  mergeMax: string;
  women: string;
  men: string;
}

interface Removal {
  id: string;
  name: string;
}

/**
 * The yearly evaluation like in the Intranet: ranking, statistic, honours and the sheet of every
 * swimmer, the same Excel file, and the upload of the base times. The season is chosen on the page,
 * as the file is made late in the new year for the season before. All points are worked out from
 * the results of the meets in the portal.
 */
@Component({
  selector: 'app-competition-evaluation',
  imports: [Action, ConfirmDialog, EvaluationBlocks, Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluation.html',
  styleUrl: './evaluation.scss',
})
export class CompetitionEvaluation {
  protected readonly store = inject(EvaluationStore);
  private readonly toasts = inject(Toasts);

  protected readonly tabs = TABS;
  protected readonly groups = ['Alle', 'Gesamt', 'Weiblich', 'Männlich', 'Masters'];
  protected readonly bahnChoices: { id: BahnChoice; label: string }[] = [
    { id: 'best', label: 'Beste Wertung' },
    { id: 'Lang', label: 'Langbahn' },
    { id: 'Kurz', label: 'Kurzbahn' },
  ];
  protected readonly date = longDate;
  protected readonly courseName = COURSE_NAME;

  protected readonly tab = signal<Tab>('rank');
  private readonly chosenYear = signal('');
  protected readonly bahn = signal<BahnChoice>('best');
  protected readonly group = signal('Alle');
  private readonly chosenSwimmer = signal('');
  protected readonly query = signal('');

  protected readonly ev = this.store.evaluation;
  protected readonly seasons = computed(() => this.ev().seasons());
  /** The chosen season; without a choice the newest one with results. */
  protected readonly year = computed(() => {
    const chosen = this.chosenYear();
    return this.seasons().includes(chosen) ? chosen : this.ev().defaultSeason();
  });
  /** Whether the season has results to work with. */
  protected readonly hasResults = computed(
    () => this.ev().meetsWithResults(this.year()).length > 0,
  );
  protected readonly title = computed(
    () => this.tabs.find((entry) => entry.id === this.tab())?.label ?? '',
  );

  /** Hint while the newest base times belong to an earlier year than today. */
  protected readonly expired = computed(() => this.ev().waExpired());
  protected readonly usesSample = computed(() =>
    this.store.waSets().some((set) => set.file === WA_SAMPLE_FILE),
  );

  // ---------- Rangliste ----------
  private readonly list = computed(() => this.ev().ranking(this.year(), this.bahn()));
  protected readonly rankBlocks = computed(() =>
    rankingBlocks(this.ev(), this.year(), this.list(), this.group()),
  );
  protected readonly waInfo = computed(() => this.ev().waInfo());

  // ---------- Statistik ----------
  protected readonly statPage = computed(() => [
    ...statBlocks(this.ev(), this.year()),
    ...memberBlocks(this.ev(), this.year()),
  ]);
  protected readonly missing = computed(() => this.ev().missing(this.year()));
  /** Meets with results but without a pool length: no points can be worked out for them. */
  protected readonly noPool = computed(() =>
    this.ev()
      .stat(this.year())
      .events.filter((row) => !row.poolMeters),
  );

  // ---------- Ehrungen ----------
  protected readonly bestList = computed(() => this.ev().ranking(this.year(), 'best'));
  protected readonly honourBlocks = computed(() =>
    honourPage(this.ev(), this.year(), this.bestList()),
  );

  // ---------- Einzelblatt ----------
  protected readonly names = computed(() =>
    [...this.bestList()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
  );
  protected readonly shownNames = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.names().filter((swimmer) => !query || swimmer.name.toLowerCase().includes(query));
  });
  protected readonly swimmer = computed(() => {
    const list = this.bestList();
    return list.find((item) => item.name === this.chosenSwimmer()) ?? list[0] ?? null;
  });
  protected readonly place = computed(() => {
    const swimmer = this.swimmer();
    return swimmer ? this.bestList().indexOf(swimmer) + 1 : 0;
  });
  protected readonly position = computed(() => {
    const swimmer = this.swimmer();
    return swimmer ? this.names().indexOf(swimmer) : -1;
  });
  protected readonly sheet = computed(() => {
    const swimmer = this.swimmer();
    return swimmer ? sheetBlocks(this.ev(), this.year(), swimmer) : [];
  });
  protected readonly gaps = computed(() => {
    const swimmer = this.swimmer();
    return swimmer ? this.ev().swimmerGaps(this.year(), swimmer.name) : [];
  });

  // ---------- Hochladen ----------
  protected readonly waSets = computed(() =>
    [...this.store.waSets()].sort((a, b) => b.von.localeCompare(a.von)),
  );
  protected readonly sampleFile = WA_SAMPLE_FILE;
  protected readonly waMessage = signal('');
  protected readonly waPreview = signal<WaPreview | null>(null);
  protected readonly waDates = signal<Record<string, { von: string; bis: string }>>({});
  protected readonly bandsForm = signal<BandsForm | null>(null);
  protected readonly removal = signal<Removal | null>(null);

  protected pickSeason(event: Event): void {
    this.chosenYear.set((event.target as HTMLSelectElement).value);
  }

  protected pickSwimmer(name: string): void {
    this.chosenSwimmer.set(name);
  }

  protected typedQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** The previous (-1) or next (1) swimmer of the alphabetical list. */
  protected step(direction: -1 | 1): void {
    const next = this.names()[this.position() + direction];
    if (next) this.chosenSwimmer.set(next.name);
  }

  protected setPool(id: string, pool: 25 | 50): void {
    this.store.setPool(id, pool);
  }

  protected download(): void {
    try {
      const bytes = createReportXlsx(evaluationSheets(this.ev(), this.year()));
      downloadBytes(evaluationFileName(this.year()), bytes, XLSX_TYPE);
    } catch {
      this.toasts.failed('Die Excel-Datei konnte nicht erstellt werden');
    }
  }

  // ---------- base times ----------
  protected async readWa(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.waMessage.set(
      'Wird gelesen … (bei PDF-Dateien wird beim ersten Mal der PDF-Leser geladen)',
    );
    try {
      const results: WaResult[] = [];
      for (const file of files) {
        const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
        results.push(
          pdf
            ? parseWaPdf(await readPdfLines(file), file.name)
            : parseWaCsv(await readTextFile(file)),
        );
      }
      const result = mergeWa(results);
      this.waDates.set(
        Object.fromEntries(
          result.list.map((read): [string, { von: string; bis: string }] => [
            read.id,
            { von: read.von, bis: read.bis },
          ]),
        ),
      );
      this.waPreview.set({ result, file: files.map((file) => file.name).join(', ') });
      this.waMessage.set('');
    } catch (error) {
      this.waMessage.set(
        error instanceof Error ? error.message : 'Die Dateien konnten nicht gelesen werden.',
      );
    } finally {
      input.value = '';
    }
  }

  protected waDate(id: string, key: 'von' | 'bis'): string {
    return this.waDates()[id][key];
  }

  protected setWaDate(id: string, key: 'von' | 'bis', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.waDates.update((all) => ({ ...all, [id]: { ...all[id], [key]: value } }));
  }

  protected replacesWa(id: string): boolean {
    return this.store.waSets().some((set) => set.id === id);
  }

  protected saveWa(): void {
    const preview = this.waPreview();
    if (!preview) return;
    const sets: WaSet[] = [];
    for (const read of preview.result.list) {
      const dates = this.waDates()[read.id];
      if (!dates.von || !dates.bis || dates.von > dates.bis) {
        this.toasts.failed(
          `Bitte bei ${COURSE_NAME[read.course]} ${read.jahr} das Datum prüfen: „ab“ muss vor „bis“ liegen`,
        );
        return;
      }
      sets.push(toWaSet(read, dates.von, dates.bis, this.store.today, preview.file));
    }
    this.store.saveWaSets(sets);
    this.waPreview.set(null);
    this.toasts.saved('Basiszeiten übernommen');
  }

  protected countOf(set: WaSet): number {
    return Object.keys(set.t).length;
  }

  // ---------- groups ----------
  protected openBands(): void {
    const ev = this.ev();
    const year = this.year();
    this.bandsForm.set({
      masters: String(ev.masters()),
      mergeMax: String(ev.mergeMax()),
      women: bandsToText(ev.bandList(year, 'W')),
      men: bandsToText(ev.bandList(year, 'M')),
    });
  }

  protected setBands(field: keyof BandsForm, event: Event): void {
    const form = this.bandsForm();
    if (!form) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.bandsForm.set({ ...form, [field]: value });
  }

  protected saveBands(): void {
    const form = this.bandsForm();
    if (!form) return;
    const year = this.year();
    const config = this.store.config();
    const own = (text: string, all: Record<string, BandDef[]>): Record<string, BandDef[]> => {
      const bands = textToBands(text);
      const next = { ...all };
      if (!bands.length || isDefaultBands(bands, year)) delete next[year];
      else next[year] = bands;
      return next;
    };
    const masters = Math.round(Number(form.masters));
    this.store.setConfig({
      masters: masters > 0 ? masters : 25,
      mergeMax: Math.max(0, Math.min(9, Math.round(Number(form.mergeMax)) || 0)),
      bandsW: own(form.women, config.bandsW),
      bandsM: own(form.men, config.bandsM),
    });
    this.bandsForm.set(null);
    this.toasts.saved('Gruppen gespeichert');
  }

  // ---------- delete ----------
  protected askRemove(id: string, name: string): void {
    this.removal.set({ id, name });
  }

  protected remove(): void {
    const item = this.removal();
    if (!item) return;
    this.store.removeWaSet(item.id);
    this.removal.set(null);
    this.toasts.show('Gelöscht', 'info');
  }
}
