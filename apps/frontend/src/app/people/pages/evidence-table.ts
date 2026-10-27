import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { MailDialog } from '../../training/dialogs/mail-dialog';
import { fullDate } from '../../training/training-dates';
import { EVIDENCE_KINDS, EVIDENCE_LABELS, EvidenceKind, EvidenceRow } from '../people-evidence';
import { fullName } from '../people.models';
import { PeopleStore } from '../people.store';

type Period = 'all' | 'overdue' | '30' | '90';

@Component({
  selector: 'app-evidence-table',
  imports: [RouterLink, Icon, MailDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evidence-table.html',
})
export class EvidenceTable {
  private readonly store = inject(PeopleStore);
  protected readonly kinds = EVIDENCE_KINDS;
  protected readonly labels = EVIDENCE_LABELS;
  protected readonly fullDate = fullDate;

  protected readonly period = signal<Period>('all');
  protected readonly kind = signal<EvidenceKind | ''>('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly mailing = signal(false);
  protected readonly message = signal('');

  private readonly due = this.store.dueEvidence;

  protected readonly periods = computed(() => {
    const rows = this.due();
    const count = (test: (row: EvidenceRow) => boolean) => rows.filter(test).length;
    return [
      { id: 'all' as const, label: 'Alle', count: rows.length },
      { id: 'overdue' as const, label: 'Abgelaufen', count: count(this.isOverdue) },
      { id: '30' as const, label: 'Nächste 30 Tage', count: count((row) => this.within(row, 30)) },
      { id: '90' as const, label: 'Nächste 90 Tage', count: count((row) => this.within(row, 90)) },
    ];
  });

  protected readonly rows = computed(() => {
    const period = this.period();
    const kind = this.kind();
    return this.due().filter((row) => {
      if (kind && row.kind !== kind) return false;
      if (period === 'overdue') return this.isOverdue(row);
      if (period === '30') return this.within(row, 30);
      if (period === '90') return this.within(row, 90);
      return true;
    });
  });

  protected readonly recipients = computed(() => {
    const ids = this.selected();
    const names = this.rows()
      .filter((row) => ids.has(this.key(row)))
      .map((row) => fullName(row.member));
    return [...new Set(names)];
  });

  protected key(row: EvidenceRow): string {
    return `${row.member.id}:${row.kind}`;
  }

  protected rest(row: EvidenceRow): string {
    if (row.missing) return 'fehlt';
    if (row.days === null) return '';
    return row.days < 0 ? `${-row.days} Tage überfällig` : `${row.days} Tage`;
  }

  protected toggle(row: EvidenceRow): void {
    const key = this.key(row);
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected sent(): void {
    this.mailing.set(false);
    this.selected.set(new Set());
    this.message.set('Demo: Die Erinnerung wurde vorbereitet, aber nicht versendet.');
  }

  protected readonly isOverdue = (row: EvidenceRow): boolean =>
    row.missing || (row.days !== null && row.days < 0);

  private within(row: EvidenceRow, days: number): boolean {
    return row.days !== null && row.days >= 0 && row.days <= days;
  }
}
