import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface TabDef {
  id: string;
  label: string;
  /** A number behind the label, shown when it is above 0. */
  count?: number;
}

/** The tab bar of a page; the page decides what to show for the active tab. */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      <ul>
        @for (item of tabs(); track item.id) {
          <li [class.is-active]="active() === item.id">
            <a
              role="tab"
              tabindex="0"
              [attr.aria-selected]="active() === item.id"
              (click)="active.set(item.id)"
              (keydown.enter)="active.set(item.id)"
            >
              {{ item.label }}
              @if (item.count) {
                <span class="tag is-danger is-rounded ml-2">{{ item.count }}</span>
              }
            </a>
          </li>
        }
      </ul>
    </div>
  `,
})
export class Tabs {
  readonly tabs = input.required<readonly TabDef[]>();
  readonly active = model.required<string>();
}
