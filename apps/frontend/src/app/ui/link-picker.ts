import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { LinkTargets } from './link-targets';

/** Two steps: first the kind of target (page, session, task, ...), then the single entry. */
@Component({
  selector: 'app-link-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <div class="select" [class.is-small]="small()">
        <select aria-label="Art des Ziels" (change)="pickCategory($event)">
          <option value="" [selected]="!category()">{{ placeholder() }}</option>
          @for (group of targets.groups(); track group.label) {
            <option [value]="group.label" [selected]="group.label === category()">
              {{ group.label }} ({{ group.targets.length }})
            </option>
          }
        </select>
      </div>
      @if (entries().length > 0) {
        <div class="select" [class.is-small]="small()">
          <select [attr.aria-label]="label()" (change)="pick($event)">
            <option value="">Eintrag wählen …</option>
            @for (target of entries(); track target.path) {
              <option [value]="target.path" [selected]="target.path === value()">
                {{ target.label }}
              </option>
            }
          </select>
        </div>
      }
    </div>
  `,
  styles: `
    .picker {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .select,
    select {
      max-width: 100%;
    }
  `,
})
export class LinkPicker {
  protected readonly targets = inject(LinkTargets);
  readonly value = input('');
  readonly label = input('Ziel im Portal');
  readonly placeholder = input('Nichts verknüpft');
  readonly small = input(false);
  readonly picked = output<string>();

  /** The shown kind starts with the kind of the stored link. */
  protected readonly category = linkedSignal(
    () =>
      this.targets
        .groups()
        .find((group) => group.targets.some((target) => target.path === this.value()))?.label ?? '',
  );

  protected readonly entries = computed(
    () => this.targets.groups().find((group) => group.label === this.category())?.targets ?? [],
  );

  protected pickCategory(event: Event): void {
    const label = (event.target as HTMLSelectElement).value;
    this.category.set(label);
    if (!label) this.picked.emit('');
  }

  protected pick(event: Event): void {
    this.picked.emit((event.target as HTMLSelectElement).value);
  }
}
