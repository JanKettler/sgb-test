import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { euro } from '../../core/money';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { downloadStatement, printStatement } from '../billing.files';
import {
  PERIODS,
  STATEMENT_LABEL,
  Statement,
  StatementLine,
  StatementState,
  emptyLine,
  hoursText,
  rateFor,
  sameOwner,
  sumsOf,
} from '../billing.models';
import { BillingStore } from '../billing.store';

type Section = 'basics' | 'car' | 'bank';

const CAR_FIELDS: readonly FieldDef[] = [
  { key: 'km', label: 'PKW: gefahrene km', type: 'number' },
  { key: 'kmRate', label: 'Euro pro km', type: 'number' },
  { key: 'carText', label: 'PKW: wofür? (steht unter der Zeile)' },
  { key: 'extra', label: 'Sonstiges (€)', type: 'number' },
  { key: 'extraText', label: 'Sonstiges: wofür? (steht unter der Zeile)' },
];

const BANK_FIELDS: readonly FieldDef[] = [
  { key: 'accountHolder', label: 'Kontoinhaber (falls abweichend)' },
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
];

/** Statement of a trainer: the data, the units held, kilometres, other costs and the bank account. */
@Component({
  selector: 'app-statement-editor',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statement-editor.html',
})
export class StatementEditor {
  protected readonly store = inject(BillingStore);
  private readonly toasts = inject(Toasts);

  readonly statementId = input.required<string>();
  readonly closed = output();

  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly hoursText = hoursText;
  protected readonly sumsOf = sumsOf;
  protected readonly stateLabel = STATEMENT_LABEL;
  protected readonly carFields = CAR_FIELDS;
  protected readonly bankFields = BANK_FIELDS;

  protected readonly section = signal<Section | null>(null);
  protected readonly editingLine = signal<StatementLine | null>(null);
  protected readonly toDelete = signal(false);

  protected readonly statement = computed(() => this.store.statement(this.statementId()));
  protected readonly editable = computed(() => {
    const statement = this.statement();
    return statement !== undefined && this.store.canEdit(statement);
  });
  protected readonly owns = computed(() => {
    const statement = this.statement();
    return statement !== undefined && sameOwner(statement.owner, this.store.me());
  });

  protected readonly basicFields = computed<FieldDef[]>(() => {
    const statement = this.statement();
    const year = Number(this.store.today.slice(0, 4));
    const titles = [year, year - 1].flatMap((value) =>
      PERIODS.map((period) => `${period} ${value}`),
    );
    const standard = statement ? rateFor(this.store.rates(), statement.license) : 0;
    return [
      {
        key: 'title',
        label: 'Zeitraum (z. B. Jan - Mai 2026)',
        required: true,
        suggestions: titles,
      },
      { key: 'name', label: 'Name', required: true },
      { key: 'edv', label: 'ÜL-EDV-Nr.' },
      {
        key: 'license',
        label: 'Lizenz',
        suggestions: this.store.rates().licenses.map((entry) => entry.name),
      },
      {
        key: 'rate',
        label: 'Satz pro Stunde (€)',
        type: 'number',
        hint: `Laut Sätzen für diese Lizenz: ${euro(standard)}.`,
      },
    ];
  });

  protected readonly lineFields = computed<FieldDef[]>(() => [
    { key: 'date', label: 'Datum', type: 'date', required: true },
    { key: 'time', label: 'Beginn', type: 'time' },
    { key: 'minutes', label: 'Minuten', type: 'number', required: true },
    { key: 'group', label: 'Gruppe', suggestions: this.store.groupSuggestions() },
    { key: 'place', label: 'Ort', suggestions: this.store.placeSuggestions() },
  ]);

  protected addLine(): void {
    this.editingLine.set(emptyLine(this.store.today));
  }

  protected saveLine(values: FormValues): void {
    const current = this.editingLine();
    if (!current) return;
    const problem = this.store.saveLine(this.statementId(), {
      ...current,
      date: textOf(values, 'date'),
      time: textOf(values, 'time'),
      minutes: Math.round(numberOf(values, 'minutes')),
      group: textOf(values, 'group'),
      place: textOf(values, 'place'),
    });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved(current.id ? 'Zeile gespeichert' : 'Zeile hinzugefügt');
    this.editingLine.set(null);
  }

  protected removeLine(line: StatementLine): void {
    this.store.removeLine(this.statementId(), line.id);
    this.toasts.saved('Zeile gelöscht');
  }

  /** Takes over the training units of the period that are on no statement yet. */
  protected fromTraining(statement: Statement): void {
    const added = this.store.addLines(statement.id, this.store.candidateLines(statement));
    if (added === 0) this.toasts.show('Keine neuen Trainingstermine in diesem Zeitraum.', 'info');
    else this.toasts.saved(`${added} ${added === 1 ? 'Einheit' : 'Einheiten'} übernommen`);
  }

  protected saveBasics(values: FormValues): void {
    this.store.update(this.statementId(), {
      title: textOf(values, 'title'),
      name: textOf(values, 'name'),
      edv: textOf(values, 'edv'),
      license: textOf(values, 'license'),
      rate: Math.max(0, numberOf(values, 'rate')),
    });
    this.done('Angaben gespeichert');
  }

  protected saveCar(values: FormValues): void {
    this.store.update(this.statementId(), {
      km: Math.max(0, numberOf(values, 'km')),
      kmRate: Math.max(0, numberOf(values, 'kmRate')),
      carText: textOf(values, 'carText'),
      extra: Math.max(0, numberOf(values, 'extra')),
      extraText: textOf(values, 'extraText'),
    });
    this.done('PKW und Sonstiges gespeichert');
  }

  protected saveBank(values: FormValues): void {
    this.store.update(this.statementId(), {
      accountHolder: textOf(values, 'accountHolder'),
      iban: textOf(values, 'iban'),
      bic: textOf(values, 'bic'),
    });
    this.done('Überweisung gespeichert');
  }

  protected setState(statement: Statement, state: StatementState): void {
    const problem = this.store.setState(statement.id, state);
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    const message = {
      draft: 'Wieder ein Entwurf',
      submitted: 'Abrechnung eingereicht',
      paid: 'Als bezahlt markiert',
    }[state];
    this.toasts.saved(message);
  }

  protected confirmDelete(): void {
    this.store.remove(this.statementId());
    this.toasts.saved('Abrechnung gelöscht');
    this.toDelete.set(false);
    this.closed.emit();
  }

  protected exportExcel(statement: Statement): void {
    downloadStatement(statement);
  }

  protected print(statement: Statement): void {
    printStatement(statement, this.store.today);
  }

  private done(message: string): void {
    this.toasts.saved(message);
    this.section.set(null);
  }
}
