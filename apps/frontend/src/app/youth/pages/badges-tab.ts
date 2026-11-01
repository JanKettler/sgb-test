import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { euro } from '../../competition/competition.models';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { SearchField } from '../../ui/search-field';
import { Toasts } from '../../ui/toast';
import { openBadgesBook } from '../youth.export';
import {
  BADGE_STATES,
  BADGE_STATE_LABEL,
  BadgeRecord,
  badgeStateOf,
  emptyRecord,
  ticked,
} from '../youth.models';
import { PersonBadges, YouthStore } from '../youth.store';

type StateFilter = '' | 'laufend' | 'bestanden';

const STATE_OPTIONS = BADGE_STATES.map((state) => ({
  value: state,
  label: state === 'bezahlt' ? 'Bestanden und bezahlt (bar)' : BADGE_STATE_LABEL[state],
}));

/** The badges of the members: who is working on which badge, who passed, who still has to pay. */
@Component({
  selector: 'app-youth-badges',
  imports: [Action, FormDialog, ConfirmDialog, SearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badges-tab.html',
})
export class BadgesTab {
  protected readonly store = inject(YouthStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly stateLabel = BADGE_STATE_LABEL;

  protected readonly query = signal('');
  protected readonly filter = signal<StateFilter>('');
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly editing = signal<BadgeRecord | null>(null);
  protected readonly toPass = signal<BadgeRecord | null>(null);
  protected readonly toPay = signal<BadgeRecord | null>(null);
  protected readonly toDelete = signal<BadgeRecord | null>(null);

  protected readonly fields = computed<FieldDef[]>(() => {
    const fields: FieldDef[] = [
      {
        key: 'name',
        label: 'Person (Name oder Mitgliedsnummer)',
        required: true,
        suggestions: this.store.memberNames(),
      },
      {
        key: 'badge',
        label: 'Abzeichen (mit Preis)',
        type: 'select',
        options: this.store
          .catalog()
          .map((kind) => ({ value: kind.name, label: `${kind.name} – ${euro(kind.price)}` })),
      },
      { key: 'date', label: 'Datum', type: 'date' },
      {
        key: 'price',
        label: 'Preis (€)',
        type: 'number',
        hint: 'Leer lassen: es gilt der Preis des Abzeichens.',
      },
    ];
    if (!this.editing()?.id) {
      fields.push({ key: 'state', label: 'Stand', type: 'select', options: STATE_OPTIONS });
    }
    fields.push({ key: 'note', label: 'Notiz (z. B. „Theorie fehlt“)', type: 'textarea', rows: 2 });
    return fields;
  });

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    const filter = this.filter();
    return this.store
      .persons()
      .filter(
        (person) =>
          !query ||
          person.name.toLocaleLowerCase('de').includes(query) ||
          person.memberNo.includes(query),
      )
      .filter((person) => !filter || person.records.some((record) => record.state === filter));
  });

  /** Checks the name and, for a badge that is paid right away, that the month is still open. */
  protected readonly check = (values: FormValues): string => {
    const current = this.editing();
    const problem = this.store.nameProblem(textOf(values, 'name'), current?.name ?? '');
    if (problem) return problem;
    return !current?.id && textOf(values, 'state') === 'bezahlt'
      ? this.store.payProblem(this.priceIn(values))
      : '';
  };

  protected isOpen(key: string): boolean {
    return this.opened().has(key);
  }

  protected toggleOpen(key: string): void {
    this.opened.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected pillText(record: BadgeRecord): string {
    if (record.state === 'bezahlt') return `${record.badge} ✓`;
    if (record.state === 'bestanden') {
      return `${record.badge} · ${euro(this.store.priceOf(record))} offen`;
    }
    return `${record.badge} · in Arbeit`;
  }

  protected sortedRecords(person: PersonBadges): BadgeRecord[] {
    return [...this.store.visibleOf(person)].sort((a, b) => b.date.localeCompare(a.date));
  }

  protected detail(record: BadgeRecord): string {
    const kind = this.store.kindOf(record.badge);
    const progress =
      kind.requirements.length > 0
        ? `${ticked(record, kind)} von ${kind.requirements.length} Anforderungen`
        : '';
    return [progress, record.date && fullDate(record.date)].filter(Boolean).join(' · ');
  }

  protected add(name: string): void {
    this.editing.set({ ...emptyRecord(this.store.today, this.store.kindNames()[0] ?? ''), name });
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    const problem = this.store.saveRecord(
      {
        ...current,
        badge: textOf(values, 'badge'),
        date: textOf(values, 'date'),
        price: textOf(values, 'price') === '' ? null : this.priceIn(values),
        state: current.id ? current.state : badgeStateOf(textOf(values, 'state')),
        note: textOf(values, 'note'),
      },
      textOf(values, 'name'),
    );
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved(current.id ? 'Eintrag gespeichert' : 'Abzeichen eingetragen');
    this.editing.set(null);
  }

  protected confirmPassed(): void {
    const record = this.toPass();
    if (record) {
      this.store.markPassed(record.id);
      this.toasts.saved('Als bestanden eingetragen');
    }
    this.toPass.set(null);
  }

  protected confirmPaid(): void {
    const record = this.toPay();
    if (record) {
      const problem = this.store.markPaid(record.id);
      if (problem) this.toasts.failed(problem);
      else this.toasts.saved('Bezahlt, in die Jugendkasse gebucht');
    }
    this.toPay.set(null);
  }

  protected confirmDelete(): void {
    const record = this.toDelete();
    if (record) {
      this.store.removeRecord(record.id);
      this.toasts.saved('Eintrag gelöscht');
    }
    this.toDelete.set(null);
  }

  protected missing(record: BadgeRecord): number {
    const kind = this.store.kindOf(record.badge);
    return kind.requirements.length - ticked(record, kind);
  }

  protected exportExcel(): void {
    if (this.store.records().every((record) => record.state === 'bezahlt')) {
      this.toasts.show('Keine offenen Abzeichen.', 'info');
      return;
    }
    downloadXlsx(
      'Offene_Abzeichen.xlsx',
      openBadgesBook(
        this.store.records(),
        (name) => this.store.kindOf(name),
        (record) => this.store.priceOf(record),
        this.store.today,
      ),
    );
  }

  private priceIn(values: FormValues): number {
    return textOf(values, 'price') === ''
      ? this.store.kindOf(textOf(values, 'badge')).price
      : numberOf(values, 'price');
  }
}
