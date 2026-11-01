import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { Competition, FeeStatus, PHASES, Participation } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

/** Checklist of one meet: what is done, fee status, participation and the number of judges. */
@Component({
  selector: 'app-meet-checklist',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meet-checklist.html',
  styleUrl: './meet-checklist.scss',
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

  protected phaseDone(item: Competition, phase: (typeof PHASES)[number]): number {
    return phase.items.filter((step) => this.store.isStepDone(item, step[0])).length;
  }

  /** Persons already named as judges of the section in the "Kampfrichter & Trainer" tab. */
  protected named(item: Competition, section: number): number {
    return item.officials[section]?.length ?? 0;
  }

  protected date(iso: string): string {
    return iso.split('-').reverse().join('.');
  }

  protected setJudges(section: number, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.store.setJudges(this.id(), section, text === '' ? null : Number(text));
  }
}
