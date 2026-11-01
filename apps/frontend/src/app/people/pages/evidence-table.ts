import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Toasts } from '../../ui/toast';
import { RouterLink } from '@angular/router';
import { DateField } from '../../ui/date-field';
import { Icon } from '../../ui/icon';
import { SortButton, SortState } from '../../ui/sort';
import { TablePager, pageOf } from '../../ui/table-pager';
import { MailDialog } from '../../training/dialogs/mail-dialog';
import { addDays, fullDate } from '../../training/training-dates';
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_LABELS,
  EvidenceCategory,
  EvidenceKind,
  EVIDENCE_FIELDS,
  EvidenceRow,
  categoryOf,
} from '../people-evidence';
import { fullName } from '../people.models';
import { PeopleStore } from '../people.store';

type Period = 'all' | 'overdue' | '30' | 'range';

@Component({
  selector: 'app-evidence-table',
  imports: [RouterLink, Icon, MailDialog, DateField, SortButton, TablePager],
  styleUrl: './evidence-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evidence-table.html',
})
export class EvidenceTable {
  protected readonly toasts = inject(Toasts);
  protected readonly store = inject(PeopleStore);
  protected readonly categories = Object.entries(EVIDENCE_CATEGORIES) as [
    EvidenceCategory,
    (typeof EVIDENCE_CATEGORIES)[EvidenceCategory],
  ][];
  protected readonly labels = EVIDENCE_LABELS;
  protected readonly fullDate = fullDate;

  protected readonly category = signal<EvidenceCategory>('proof');
  protected readonly period = signal<Period>('all');
  protected readonly from = signal(this.store.today);
  protected readonly to = signal(addDays(this.store.today, 90));
  protected readonly kind = signal<EvidenceKind | ''>('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly mailing = signal(false);

  private readonly due = this.store.dueEvidence;

  /** The evidence of the shown category, before the period is applied. */
  private readonly inCategory = computed(() =>
    this.due().filter((row) => categoryOf(row.kind) === this.category()),
  );

  protected readonly kinds = computed(() => EVIDENCE_CATEGORIES[this.category()].kinds);
  protected readonly hiddenKinds = computed(
    () => this.hideKinds().filter((item) => item.on).length,
  );

  protected readonly hideKinds = computed(() =>
    this.kinds().map((kind) => ({
      kind,
      label: EVIDENCE_LABELS[kind],
      on: this.store.hideMissing()[kind],
    })),
  );

  protected readonly periods = computed(() => {
    const rows = this.inCategory();
    const count = (test: (row: EvidenceRow) => boolean) => rows.filter(test).length;
    return [
      { id: 'all' as const, label: 'Alle', count: rows.length },
      { id: 'overdue' as const, label: 'Abgelaufen', count: count(this.isOverdue) },
      { id: '30' as const, label: 'Nächste 30 Tage', count: count((row) => this.within(row, 30)) },
    ];
  });

  protected readonly sort = new SortState('rest');
  protected readonly page = signal(0);
  protected readonly size = signal(25);

  protected readonly rows = computed(() => {
    const period = this.period();
    const kind = this.kind();
    const key = this.sort.key();
    const compare = (a: EvidenceRow, b: EvidenceRow): number => {
      if (key === 'person') {
        return (
          a.member.lastName.localeCompare(b.member.lastName, 'de') ||
          a.member.firstName.localeCompare(b.member.firstName, 'de')
        );
      }
      if (key === 'kind') return a.label.localeCompare(b.label, 'de');
      if (key === 'role') return a.role.localeCompare(b.role, 'de');
      if (key === 'date') return (a.date || '0000').localeCompare(b.date || '0000');
      return (a.days ?? -9999) - (b.days ?? -9999);
    };
    return this.inCategory()
      .filter((row) => {
        if (kind && row.kind !== kind) return false;
        if (period === 'overdue') return this.isOverdue(row);
        if (period === '30') return this.within(row, 30);
        if (period === 'range')
          return !!row.date && row.date >= this.from() && row.date <= this.to();
        return true;
      })
      .sort((a, b) => this.sort.apply(compare(a, b)));
  });

  protected readonly pageRows = computed(() => pageOf(this.rows(), this.page(), this.size()));

  protected readonly recipients = computed(() => {
    const ids = this.selected();
    const names = this.rows()
      .filter((row) => ids.has(this.key(row)))
      .map((row) => fullName(row.member));
    return [...new Set(names)];
  });

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected setPeriod(value: string): void {
    this.period.set(value as Period);
    this.page.set(0);
  }

  protected setKind(value: string): void {
    this.kind.set(value as EvidenceKind | '');
    this.page.set(0);
  }

  protected selectCategory(category: EvidenceCategory): void {
    this.page.set(0);
    this.category.set(category);
    this.kind.set('');
    this.selected.set(new Set());
  }

  protected toggleHiding(kind: EvidenceKind, on: boolean): void {
    this.store.setHideMissing(kind, !on);
  }

  /** Enters the date right in the row. */
  protected setDate(row: EvidenceRow, date: string): void {
    if (!date || date === row.date) return;
    this.store.save({ ...row.member, [EVIDENCE_FIELDS[row.kind]]: date });
    this.toasts.saved(`${row.label} von ${fullName(row.member)} eingetragen`);
  }

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
    this.toasts.show('Demo: Die Erinnerung wurde vorbereitet, aber nicht versendet', 'info');
  }

  protected readonly isOverdue = (row: EvidenceRow): boolean =>
    row.missing || (row.days !== null && row.days < 0);

  private within(row: EvidenceRow, days: number): boolean {
    return row.days !== null && row.days >= 0 && row.days <= days;
  }
}
