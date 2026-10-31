import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { Icon } from './icon';

/** Rows per page that can be chosen; 0 shows everything on one page. */
export const PAGE_SIZES = [10, 25, 50, 100, 0] as const;

/** The rows of one page. A size of 0 returns all rows. */
export function pageOf<T>(rows: readonly T[], page: number, size: number): T[] {
  if (size <= 0) return [...rows];
  const last = Math.max(0, Math.ceil(rows.length / size) - 1);
  const start = Math.min(page, last) * size;
  return rows.slice(start, start + size);
}

/** Choose the number of rows per page and move between pages. */
@Component({
  selector: 'app-table-pager',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pager-bar">
      <label class="is-size-7">
        Pro Seite
        <span class="select is-small">
          <select aria-label="Zeilen pro Seite" (change)="setSize($event)">
            @for (option of sizes; track option) {
              <option [value]="option" [selected]="option === size()">
                {{ option === 0 ? 'Alle' : option }}
              </option>
            }
          </select>
        </span>
      </label>
      <span class="is-size-7 has-text-grey">{{ range() }}</span>
      @if (pages() > 1) {
        <span class="buttons mb-0">
          <button
            type="button"
            class="button is-small"
            aria-label="Vorherige Seite"
            [disabled]="current() === 0"
            (click)="page.set(current() - 1)"
          >
            <app-icon name="chevron-left" />
          </button>
          <span class="is-size-7">Seite {{ current() + 1 }} von {{ pages() }}</span>
          <button
            type="button"
            class="button is-small"
            aria-label="Nächste Seite"
            [disabled]="current() >= pages() - 1"
            (click)="page.set(current() + 1)"
          >
            <app-icon name="chevron-right" />
          </button>
        </span>
      }
    </div>
  `,
  styles: `
    .pager-bar {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      justify-content: flex-end;
      margin-top: 0.75rem;
    }

    .buttons {
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class TablePager {
  readonly total = input.required<number>();
  readonly page = model(0);
  readonly size = model<number>(25);

  protected readonly sizes = PAGE_SIZES;
  protected readonly pages = computed(() =>
    this.size() <= 0 ? 1 : Math.max(1, Math.ceil(this.total() / this.size())),
  );
  protected readonly current = computed(() => Math.min(this.page(), this.pages() - 1));
  protected readonly range = computed(() => {
    const total = this.total();
    if (total === 0) return '0 Einträge';
    if (this.size() <= 0) return `${total} Einträge`;
    const from = this.current() * this.size() + 1;
    return `${from}–${Math.min(total, from + this.size() - 1)} von ${total}`;
  });

  protected setSize(event: Event): void {
    this.size.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(0);
  }
}
