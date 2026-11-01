import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** The search field above a list; it fills the row of the toolbar it sits in. */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <input
      class="input search"
      type="search"
      aria-label="Suche"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="value.set(read($event))"
    />
  `,
})
export class SearchField {
  readonly value = model('');
  readonly placeholder = input('Suchen …');

  protected read(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
