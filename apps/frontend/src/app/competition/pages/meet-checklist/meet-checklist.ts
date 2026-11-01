import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { FeeStatus, PHASES, Participation } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

/** Checklist of one meet: what is done, fee status, participation and the number of judges. */
@Component({
  selector: 'app-meet-checklist',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = competition();
    @if (item) {
      <div class="mb-3">
        <progress
          class="progress is-success mb-1"
          [value]="progress().done"
          [max]="progress().total"
        ></progress>
        <p class="help">{{ progress().done }} von {{ progress().total }} erledigt</p>
        @for (warning of warnings(); track warning.text) {
          <span
            class="pill mr-1"
            [class.is-warn]="warning.tone === 'warn'"
            [class.is-bad]="warning.tone === 'bad'"
          >
            {{ warning.text }}
          </span>
        }
      </div>

      @if (item.deadline) {
        <div class="notification is-light mb-4">
          <strong>Aus der Ausschreibung:</strong>
          Meldeschluss {{ date(item.deadline) }} {{ item.deadlineTime }} Uhr
          @if (item.internalDeadline) {
            · intern bis {{ date(item.internalDeadline) }}
          }
          @if (item.contactName) {
            · Meldeanschrift: {{ item.contactName }} {{ item.contactEmail }}
          }
        </div>
      }

      @for (phase of phases; track phase.id) {
        <section class="mb-4">
          <h3 class="title is-6 mb-2">{{ phase.label }}</h3>
          @for (step of phase.items; track step[0]) {
            <label class="checkbox is-block mb-1">
              <input
                type="checkbox"
                [checked]="store.isStepDone(item, step[0])"
                [disabled]="!store.canManage()"
                (change)="store.toggleStep(item.id, step[0])"
              />
              {{ step[1] }}
              @if (item.plan.done[step[0]]; as who) {
                <span class="has-text-grey is-size-7"> · {{ who.by }}, {{ date(who.at) }} </span>
              }
            </label>
          }
          @if (phase.id === 'entry') {
            <div class="field mt-2">
              <span class="label">Meldegeld</span>
              <div class="buttons has-addons">
                @for (option of feeOptions; track option.id) {
                  <button
                    type="button"
                    class="button is-small"
                    [class.is-info]="item.plan.fee === option.id"
                    [disabled]="!store.canManage()"
                    (click)="store.setFeeStatus(item.id, option.id)"
                  >
                    {{ option.label }}
                  </button>
                }
              </div>
            </div>
          }
        </section>
      }

      <section class="mb-4">
        <h3 class="title is-6 mb-2">Wettkampf</h3>
        <div class="field">
          <span class="label">Teilnahme</span>
          <div class="buttons has-addons">
            @for (option of participationOptions; track option.id) {
              <button
                type="button"
                class="button is-small"
                [class.is-info]="item.plan.participation === option.id"
                [disabled]="!store.canManage()"
                (click)="store.setParticipation(item.id, option.id)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>
        @for (section of item.sections; track section.no) {
          <div class="field is-flex is-align-items-center" style="gap: 0.75rem">
            <label class="label mb-0" [for]="'judges-' + section.no">
              Kampfrichter Abschnitt {{ section.no }}
            </label>
            <input
              [id]="'judges-' + section.no"
              class="input is-small"
              style="max-width: 5rem"
              type="number"
              min="0"
              inputmode="numeric"
              [value]="item.plan.judges[section.no] ?? ''"
              [disabled]="!store.canManage()"
              (change)="setJudges(section.no, $event)"
            />
          </div>
        }
      </section>
    }
  `,
})
export class MeetChecklist {
  protected readonly store = inject(CompetitionStore);
  readonly id = input.required<string>();
  protected readonly phases = PHASES;
  protected readonly competition = computed(() => this.store.competition(this.id()));
  protected readonly progress = computed(() => {
    const item = this.competition();
    return item ? this.store.progress(item) : { done: 0, total: 1 };
  });
  protected readonly warnings = computed(() => {
    const item = this.competition();
    return item ? this.store.warnings(item) : [];
  });
  protected readonly feeOptions: { id: FeeStatus; label: string }[] = [
    { id: '', label: 'Offen' },
    { id: 'mail', label: 'Mail versendet' },
    { id: 'paid', label: 'Bezahlt' },
  ];
  protected readonly participationOptions: { id: Participation; label: string }[] = [
    { id: '', label: 'Offen' },
    { id: 'yes', label: 'Wir nehmen teil' },
    { id: 'no', label: 'Wir nehmen nicht teil' },
  ];

  protected date(iso: string): string {
    return iso.split('-').reverse().join('.');
  }

  protected setJudges(section: number, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.store.setJudges(this.id(), section, text === '' ? null : Number(text));
  }
}
