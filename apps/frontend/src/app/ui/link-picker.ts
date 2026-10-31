import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LinkTargets } from './link-targets';

/** Drop-down with all pages and single items of the portal, grouped. */
@Component({
  selector: 'app-link-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="select" [class.is-small]="small()" [class.is-fullwidth]="true">
      <select [attr.aria-label]="label()" (change)="pick($event)">
        <option value="">{{ placeholder() }}</option>
        @for (group of targets.groups(); track group.label) {
          <optgroup [label]="group.label">
            @for (target of group.targets; track target.path) {
              <option [value]="target.path" [selected]="target.path === value()">
                {{ target.label }}
              </option>
            }
          </optgroup>
        }
      </select>
    </div>
  `,
})
export class LinkPicker {
  protected readonly targets = inject(LinkTargets);
  readonly value = input('');
  readonly label = input('Ziel im Portal');
  readonly placeholder = input('Ziel wählen …');
  readonly small = input(false);
  readonly picked = output<string>();

  protected pick(event: Event): void {
    this.picked.emit((event.target as HTMLSelectElement).value);
  }
}
