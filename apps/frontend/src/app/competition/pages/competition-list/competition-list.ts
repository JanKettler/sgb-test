import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { fullDate } from '../../../training/training-dates';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { Toasts } from '../../../ui/toast';
import { Competition, dateOf, euro } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

@Component({
  selector: 'app-competition-list',
  imports: [RouterLink, Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competition-list.html',
})
export class CompetitionList {
  protected readonly store = inject(CompetitionStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);

  protected readonly fullDate = fullDate;
  protected readonly euro = euro;
  protected readonly toDelete = signal<Competition | null>(null);
  protected readonly notes = signal<string[]>([]);

  protected readonly rows = computed(() =>
    [...this.store.competitions()]
      .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
      .map((competition) => ({
        competition,
        date: dateOf(competition),
        counts: this.store.counts(competition),
        fee: this.store.totalFee(competition),
        past: dateOf(competition) < this.store.today,
      })),
  );

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = this.store.importFile(await file.arrayBuffer());
    if (!result) {
      this.toasts.show('In der Datei wurde kein Wettkampf gefunden.', 'bad');
      return;
    }
    this.toasts.saved('Wettkampf aus der Datei angelegt');
    this.notes.set(result.warnings);
    if (result.warnings.length === 0)
      void this.router.navigate(['/wettkampf/wettkaempfe', result.id]);
    else this.lastId.set(result.id);
  }

  protected readonly lastId = signal('');

  protected release(competition: Competition): void {
    this.store.save({ ...competition, open: !competition.open });
    this.toasts.show(competition.open ? 'Anmeldung geschlossen' : 'Anmeldung freigegeben', 'info');
  }

  protected remove(): void {
    const competition = this.toDelete();
    if (!competition) return;
    this.store.remove(competition.id);
    this.toDelete.set(null);
    this.toasts.show('Wettkampf gelöscht', 'info');
  }
}
