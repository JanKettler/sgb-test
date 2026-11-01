import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { Toasts } from '../../../ui/toast';
import { RunStart, startKey } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { escapeHtml, printHtml } from '../../competition-download';
import { readPdfLines } from '../../pdf-text';
import { parseMeldeergebnis } from '../../wk-parse';

/** Meldeergebnis of one meet: who swims when and where, the order of the day and the judge slots. */
@Component({
  selector: 'app-meet-schedule',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = competition();
    @if (item) {
      <div class="box is-shadowless" style="border: 1px solid var(--bulma-border, #dbdbdb)">
        <p class="mb-2">
          <strong>Meldeergebnis</strong> (PDF vom Ausrichter) hochladen: Es übernimmt Uhrzeiten,
          Läufe, Bahnen und das Kampfgericht für „{{ clubName }}“.
        </p>
        @if (store.canManage()) {
          <div class="file is-small mb-2">
            <label class="file-label">
              <input
                class="file-input"
                type="file"
                accept="application/pdf,.pdf"
                (change)="read($event)"
              />
              <span class="file-cta">
                <span class="file-icon"><app-icon name="upload" /></span>
                <span class="file-label">PDF auswählen</span>
              </span>
            </label>
          </div>
        }
        @if (message()) {
          <p class="help" [class.is-danger]="failed()">{{ message() }}</p>
        }
        @if (item.schedule.stand) {
          <p class="help">Stand des Meldeergebnisses: {{ stand() }}</p>
        }
      </div>

      @if (starts().length === 0) {
        <p class="has-text-grey">Noch kein Meldeergebnis hochgeladen.</p>
      } @else {
        <div class="fees-actions">
          <button type="button" class="button" (click)="printStartList()">
            <app-icon name="download" /> Startliste drucken
          </button>
          <button type="button" class="button" (click)="printSlips(false)">
            <app-icon name="download" /> Laufzettel (nach Wettkampf)
          </button>
          <button type="button" class="button" (click)="printSlips(true)">
            <app-icon name="download" /> Laufzettel (nach Schwimmer)
          </button>
        </div>

        <h3 class="title is-5">Wer schwimmt wann wo</h3>
        @for (swimmer of swimmers(); track swimmer.name) {
          <div class="mb-3">
            <strong>{{ display(swimmer.name) }}</strong>
            <span class="has-text-grey"> ({{ swimmer.year }})</span>
            <table class="table is-narrow is-fullwidth">
              <thead>
                <tr>
                  <th>Uhr</th>
                  <th>Strecke</th>
                  <th>Lauf / Bahn</th>
                  <th>Meldezeit</th>
                </tr>
              </thead>
              <tbody>
                @for (start of swimmer.starts; track key(start)) {
                  <tr>
                    <td class="has-text-centered">
                      <strong>{{ start.t }}</strong>
                    </td>
                    <td>Wk {{ start.e }} · {{ store.eventName(item, start.e) }}</td>
                    <td class="has-text-centered">
                      {{ start.l }}/{{ start.lt }} · Bahn {{ start.b }}
                    </td>
                    <td class="has-text-centered">{{ start.m || '–' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      @if (item.schedule.duties.length > 0) {
        <h3 class="title is-5 mt-5">
          Kampfgericht für {{ clubName }}
          <span class="tag is-rounded ml-2">{{ store.openDuties(item) }} offen</span>
        </h3>
        <table class="table is-fullwidth is-hoverable">
          <thead>
            <tr>
              <th>Abschnitt</th>
              <th>Position</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            @for (duty of item.schedule.duties; track $index) {
              <tr>
                <td class="has-text-centered">{{ duty.a }}</td>
                <td>
                  {{ duty.pos }}
                  <div class="has-text-grey is-size-7">{{ duty.g }}</div>
                </td>
                <td>
                  @if (store.canManage()) {
                    <div class="select is-small">
                      <select
                        [attr.aria-label]="'Name für ' + duty.pos"
                        (change)="assign($index, $event)"
                      >
                        <option value="" [selected]="isOpen(duty.name)">offen</option>
                        @if (!isOpen(duty.name) && !known(duty.name)) {
                          <option [value]="duty.name" selected>{{ duty.name }}</option>
                        }
                        @for (person of people; track person.id) {
                          <option [value]="person.name" [selected]="person.name === duty.name">
                            {{ person.name }}
                          </option>
                        }
                      </select>
                    </div>
                  } @else {
                    {{ isOpen(duty.name) ? 'offen' : duty.name }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
})
export class MeetSchedule {
  protected readonly store = inject(CompetitionStore);
  private readonly toasts = inject(Toasts);
  readonly id = input.required<string>();
  protected readonly clubName = this.store.club.name;
  protected readonly people = this.store.staffCandidates();
  protected readonly message = signal('');
  protected readonly failed = signal(false);
  protected readonly competition = computed(() => this.store.competition(this.id()));
  protected readonly starts = computed(() => this.competition()?.schedule.starts ?? []);
  protected readonly stand = computed(() => {
    const stand = this.competition()?.schedule.stand ?? '';
    const [date, time] = stand.split(' ');
    return `${date.split('-').reverse().join('.')} ${time ?? ''}`.trim();
  });

  protected readonly swimmers = computed(() => {
    const map = new Map<string, { name: string; year: string; starts: RunStart[] }>();
    for (const start of this.starts()) {
      const entry = map.get(`${start.n}|${start.j}`) ?? {
        name: start.n,
        year: start.j,
        starts: [],
      };
      entry.starts.push(start);
      map.set(`${start.n}|${start.j}`, entry);
    }
    return [...map.values()]
      .map((entry) => ({
        ...entry,
        starts: [...entry.starts].sort((a, b) => a.t.localeCompare(b.t) || a.e - b.e),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  protected key = startKey;

  protected display(name: string): string {
    return name.replace(/^([^,]+),\s*(.+)$/, '$2 $1');
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

  private head(what: string): string {
    const item = this.competition();
    if (!item) return '';
    return `<h1>${escapeHtml(what)}</h1><div class="sub"><b>${escapeHtml(item.title)}</b> · ${escapeHtml(item.place)}</div>`;
  }

  protected printStartList(): void {
    const item = this.competition();
    if (!item) return;
    const rows = [...this.starts()].sort(
      (a, b) => a.t.localeCompare(b.t) || a.e - b.e || a.b - b.b,
    );
    const body = rows
      .map(
        (start) =>
          `<tr><td><b>${start.t}</b></td><td><b>${escapeHtml(this.display(start.n))}</b> (${escapeHtml(start.j)})<br>Wk ${start.e} · ${escapeHtml(this.store.eventName(item, start.e))}</td><td>Lauf ${start.l}/${start.lt}<br>Bahn ${start.b}</td><td>${start.m || 'ohne'}</td></tr>`,
      )
      .join('');
    const duties = item.schedule.duties
      .map(
        (duty) =>
          `<tr><td>${duty.a}</td><td>${escapeHtml(duty.pos)}</td><td>${this.isOpen(duty.name) ? '<i>noch offen</i>' : escapeHtml(duty.name)}</td></tr>`,
      )
      .join('');
    printHtml(
      `Startliste ${item.title}`,
      `${this.head(`Startliste ${this.clubName}`)}<table><tr><th>Uhr</th><th>Schwimmer / Strecke</th><th>Lauf / Bahn</th><th>Meldezeit</th></tr>${body}</table>` +
        (duties
          ? `<h2>Kampfgericht</h2><table><tr><th>Abschn.</th><th>Position</th><th>Name</th></tr>${duties}</table>`
          : ''),
    );
  }

  protected printSlips(bySwimmer: boolean): void {
    const item = this.competition();
    if (!item) return;
    const list = bySwimmer
      ? this.swimmers().flatMap((swimmer) => swimmer.starts)
      : [...this.starts()].sort((a, b) => a.e - b.e || a.l - b.l || a.b - b.b);
    const body = list
      .map(
        (start) =>
          `<tr style="height:30px"><td><b>${start.t}</b></td><td>${start.e}</td><td>${escapeHtml(this.store.eventName(item, start.e))}</td><td>${start.l}/${start.lt}</td><td>${start.b}</td><td><b>${escapeHtml(this.display(start.n))}</b></td><td>${escapeHtml(start.j)}</td><td>${start.m}</td><td style="width:16%"></td><td style="width:26%"></td></tr>`,
      )
      .join('');
    printHtml(
      `Laufzettel ${item.title}`,
      `${this.head(`Laufzettel nach ${bySwimmer ? 'Schwimmern' : 'Wettkampffolge'}`)}<table><tr><th>Uhr</th><th>Wk</th><th>Strecke</th><th>Lauf</th><th>Bahn</th><th>Schwimmer</th><th>Jg.</th><th>Meldezeit</th><th>Endzeit</th><th>Zwischenzeiten</th></tr>${body}</table>`,
      true,
    );
  }
}
