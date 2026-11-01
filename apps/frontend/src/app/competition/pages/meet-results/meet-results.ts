import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { Toasts } from '../../../ui/toast';
import { RunStart, startKey } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { readTextFile } from '../../pdf-text';
import { parseResultsDsv7 } from '../../wk-parse';

/** Results of one meet, read from the DSV7 result list of the host. */
@Component({
  selector: 'app-meet-results',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = competition();
    @if (item) {
      @if (store.canManage()) {
        <div class="box is-shadowless" style="border: 1px solid var(--bulma-border, #dbdbdb)">
          <p class="mb-2">
            <strong>Ergebnisliste</strong> (DSV7-Datei vom Ausrichter) hochladen: Sie trägt Zeiten,
            Plätze, Zwischenzeiten und das Kampfgericht für „{{ clubName }}“ ein.
          </p>
          <label class="checkbox is-block mb-2">
            <input type="checkbox" [checked]="overwrite()" (change)="overwrite.set(!overwrite())" />
            Vorhandene Zeiten überschreiben
          </label>
          <div class="file is-small mb-2">
            <label class="file-label">
              <input
                class="file-input"
                type="file"
                accept=".dsv7,.DSV7,.txt"
                (change)="read($event)"
              />
              <span class="file-cta">
                <span class="file-icon"><app-icon name="upload" /></span>
                <span class="file-label">Datei auswählen</span>
              </span>
            </label>
          </div>
          @if (message()) {
            <p class="help" [class.is-danger]="failed()">{{ message() }}</p>
          }
        </div>
      }

      @if (rows().length === 0 && item.schedule.relayResults.length === 0) {
        <p class="has-text-grey">Noch keine Ergebnisse eingelesen.</p>
      } @else {
        <div class="table-container">
          <table class="table is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th>Schwimmer</th>
                <th>Strecke</th>
                <th>Zeit</th>
                <th>Platz</th>
                <th>Wertung</th>
                <th>Zwischenzeiten</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.key) {
                <tr>
                  <td>
                    <strong>{{ display(row.start.n) }}</strong>
                    <span class="has-text-grey"> ({{ row.start.j }})</span>
                  </td>
                  <td>Wk {{ row.start.e }} · {{ store.eventName(item, row.start.e) }}</td>
                  <td class="has-text-centered">
                    @if (row.result.status) {
                      <span class="pill is-warn">{{ row.result.status }}</span>
                    } @else {
                      <strong>{{ row.result.t }}</strong>
                    }
                  </td>
                  <td class="has-text-centered">{{ row.result.place || '–' }}</td>
                  <td>{{ row.result.ageGroup }}</td>
                  <td class="is-size-7">{{ row.result.sp.join(' · ') }}</td>
                </tr>
              }
              @for (relay of item.schedule.relayResults; track relay.e) {
                <tr>
                  <td><strong>Staffel</strong></td>
                  <td>Wk {{ relay.e }} · {{ store.eventName(item, relay.e) }}</td>
                  <td class="has-text-centered">
                    @if (relay.status) {
                      <span class="pill is-warn">{{ relay.status }}</span>
                    } @else {
                      <strong>{{ relay.time }}</strong>
                    }
                  </td>
                  <td class="has-text-centered">{{ relay.place || '–' }}</td>
                  <td></td>
                  <td></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class MeetResults {
  protected readonly store = inject(CompetitionStore);
  private readonly toasts = inject(Toasts);
  readonly id = input.required<string>();
  protected readonly clubName = this.store.club.name;
  protected readonly overwrite = signal(false);
  protected readonly message = signal('');
  protected readonly failed = signal(false);
  protected readonly competition = computed(() => this.store.competition(this.id()));

  protected readonly rows = computed(() => {
    const item = this.competition();
    if (!item) return [];
    const list: { key: string; start: RunStart; result: (typeof item.schedule.results)[string] }[] =
      [];
    for (const start of item.schedule.starts) {
      const result = item.schedule.results[startKey(start)];
      if (result) list.push({ key: startKey(start), start, result });
    }
    return list.sort((a, b) => a.start.n.localeCompare(b.start.n, 'de') || a.start.e - b.start.e);
  });

  protected display(name: string): string {
    return name.replace(/^([^,]+),\s*(.+)$/, '$2 $1');
  }

  protected async read(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.failed.set(false);
    try {
      const parsed = parseResultsDsv7(await readTextFile(file), this.clubName);
      if (parsed.found.length === 0 && parsed.judges.length === 0) {
        this.failed.set(true);
        this.message.set(parsed.warnings.join(' '));
        return;
      }
      const { matched, added } = this.store.importResults(this.id(), parsed, this.overwrite());
      this.message.set(
        `${parsed.found.length} Ergebnisse gelesen (${matched} zu bekannten Starts, ${added} neu angelegt), ${parsed.judges.length} Kampfrichter-Einsätze.`,
      );
      this.toasts.show('Ergebnisse übernommen', 'info');
    } catch {
      this.failed.set(true);
      this.message.set('Die Datei konnte nicht gelesen werden.');
    }
  }
}
