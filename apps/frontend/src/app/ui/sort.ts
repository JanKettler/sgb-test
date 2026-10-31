import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Icon, IconName } from './icon';

/** Which column a table is sorted by, and in which direction. */
export class SortState {
  readonly key = signal('');
  readonly desc = signal(false);

  constructor(initial: string) {
    this.key.set(initial);
  }

  toggle(key: string): void {
    if (this.key() === key) this.desc.update((desc) => !desc);
    else {
      this.key.set(key);
      this.desc.set(false);
    }
  }

  icon(key: string): IconName {
    if (this.key() !== key) return 'sort';
    return this.desc() ? 'sort-down' : 'sort-up';
  }

  /** Applies the direction to a comparison result. */
  apply(order: number): number {
    return this.desc() ? -order : order;
  }
}

/** Column heading that sorts on click. */
@Component({
  selector: 'app-sort-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="sort-btn" (click)="sort().toggle(column())">
      {{ label() }}
      <app-icon
        [name]="sort().icon(column())"
        [class.has-text-grey-light]="sort().key() !== column()"
      />
    </button>
  `,
})
export class SortButton {
  readonly label = input.required<string>();
  readonly column = input.required<string>();
  readonly sort = input.required<SortState>();
}
