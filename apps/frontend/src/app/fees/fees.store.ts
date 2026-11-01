import { Injectable, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { Member, fullName } from '../people/people.models';
import { fullDate } from '../training/training-dates';
import { FeeSettings, FeeType, Payment, euro } from './fees.models';
import {
  SAMPLE_FEE_TYPES,
  SAMPLE_SETTINGS,
  createPaymentSample,
  describeGroup,
} from './fees.sample';

const BOM = String.fromCharCode(0xfeff);
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export interface DunningRow {
  payment: Payment;
  level: number;
  fee: number;
  total: number;
}

/** In-memory stand-in for the future fees API. */
@Injectable({ providedIn: 'root' })
export class FeesStore {
  private readonly people = inject(PeopleStore);
  readonly today = this.people.today;
  private nextId = 1;

  readonly types = signal<FeeType[]>(structuredClone(SAMPLE_FEE_TYPES));
  readonly settings = signal<FeeSettings>({ ...SAMPLE_SETTINGS });
  readonly payments = signal<Payment[]>(
    createPaymentSample(this.today, this.people.members(), this.people.parents(), this.types()),
  );
  /** One-time message shown on the fees page. */
  readonly flash = signal('');

  readonly year = Number(this.today.slice(0, 4));

  readonly open = computed(() => this.payments().filter((payment) => !payment.paid));
  readonly openTotal = computed(() => this.open().reduce((sum, item) => sum + item.amount, 0));
  readonly remindedCount = computed(() => this.open().filter((item) => item.dunning > 0).length);

  /** Open payments that are overdue and have not reached the last reminder yet. */
  readonly dunningRows = computed<DunningRow[]>(() => {
    const settings = this.settings();
    return this.open()
      .filter((payment) => payment.dueDate < this.today && payment.dunning < 3)
      .map((payment) => {
        const level = payment.dunning + 1;
        const fee = level >= 2 ? settings.feeFromLevel2 : settings.feeLevel1;
        return { payment, level, fee, total: payment.amount + fee };
      });
  });

  /** Switches a payment between passive and active; "active" picks the matching fee type itself. */
  setPassive(paymentId: string, passive: boolean): void {
    const payment = this.payments().find((item) => item.id === paymentId);
    if (!payment) return;
    const members = payment.memberIds
      .map((id) => this.people.memberById().get(id))
      .filter((member): member is Member => !!member);
    const typeId = passive
      ? 'passive'
      : members.length > 0
        ? describeGroup(members, this.year).typeId
        : undefined;
    const amount = typeId ? this.feeType(typeId)?.amount : undefined;
    if (!typeId || amount === undefined) return;
    this.payments.update((all) =>
      all.map((item) => (item.id === paymentId ? { ...item, feeTypeId: typeId, amount } : item)),
    );
  }

  feeType(id: string): FeeType | undefined {
    return this.types().find((type) => type.id === id);
  }

  feeName(id: string): string {
    return this.feeType(id)?.name ?? '';
  }

  /** Number of payers per fee type, shown on the fee type list. */
  payerCount(typeId: string): number {
    return this.payments().filter((payment) => payment.feeTypeId === typeId).length;
  }

  paymentsOf(payerId: string): Payment[] {
    return this.payments().filter(
      (payment) => payment.payerId === payerId || payment.memberIds.includes(payerId),
    );
  }

  purposeOf(payment: Payment): string {
    return this.fillTemplate(this.settings().purposeTemplate, payment);
  }

  fillTemplate(template: string, payment: Payment): string {
    const member = this.people.member(payment.memberIds[0] ?? '');
    const [firstName = '', ...rest] = payment.payerName.split(' ');
    const values: Record<string, string> = {
      '[VORNAME]': member?.firstName ?? firstName,
      '[NACHNAME]': member?.lastName ?? rest.join(' '),
      '[MITGLIEDNR]': String(member?.memberNo ?? ''),
      '[JAHR]': String(this.year),
      '[BEITRAGNAME]': this.feeName(payment.feeTypeId),
      '[MONAT]': MONTHS[Number(this.today.slice(5, 7)) - 1],
      '[ZAHLINTERVALL]': 'jährlich',
    };
    return Object.entries(values)
      .reduce((text, [key, value]) => text.replaceAll(key, value), template)
      .replace(/\s+/g, ' ')
      .trim();
  }

  book(ids: ReadonlySet<string>): void {
    this.payments.update((all) =>
      all.map((payment) =>
        ids.has(payment.id) ? { ...payment, paid: true, paidOn: this.today } : payment,
      ),
    );
  }

  remove(ids: ReadonlySet<string>): void {
    this.payments.update((all) => all.filter((payment) => !ids.has(payment.id)));
  }

  /** Demo: marks the reminders as sent; nothing is mailed. */
  sendDunning(ids: ReadonlySet<string>): number {
    let sent = 0;
    this.payments.update((all) =>
      all.map((payment) => {
        if (!ids.has(payment.id) || payment.paid || payment.dunning >= 3) return payment;
        sent++;
        return { ...payment, dunning: payment.dunning + 1 };
      }),
    );
    return sent;
  }

  /**
   * Creates payments for members that do not have one this year. A new child of a family that
   * already pays joins that payment, which can change the fee type (for example to "Familie").
   */
  generate(): { created: number; adjusted: number } {
    const covered = new Set(this.payments().flatMap((payment) => payment.memberIds));
    const missing = this.people.activeMembers().filter((member) => !covered.has(member.id));
    let created = 0;
    let adjusted = 0;
    for (const member of missing) {
      const existing = this.payments().find(
        (payment) => member.parentIds.includes(payment.payerId) && payment.memberIds.length > 0,
      );
      if (existing) {
        const group = [...existing.memberIds, member.id]
          .map((id) => this.people.member(id))
          .filter((item): item is Member => !!item);
        const { typeId, label } = describeGroup(group, this.year);
        const amount = this.feeType(typeId)?.amount ?? existing.amount;
        this.payments.update((all) =>
          all.map((payment) =>
            payment.id === existing.id
              ? {
                  ...payment,
                  memberIds: group.map((item) => item.id),
                  label,
                  feeTypeId: typeId,
                  amount,
                }
              : payment,
          ),
        );
        adjusted++;
        continue;
      }
      const parent = this.people.parents().find((item) => member.parentIds.includes(item.id));
      const { typeId, label } = describeGroup([member], this.year);
      this.payments.update((all) => [
        ...all,
        {
          id: `z-new-${this.nextId++}`,
          memberIds: [member.id],
          label,
          payerId: parent?.id ?? member.id,
          payerName: parent?.name ?? fullName(member),
          feeTypeId: typeId,
          amount: this.feeType(typeId)?.amount ?? 0,
          method: (parent?.account ?? member.account).method,
          dueDate: this.today,
          paid: false,
          paidOn: '',
          dunning: 0,
          purpose: '',
        },
      ]);
      created++;
    }
    return { created, adjusted };
  }

  saveType(type: FeeType): void {
    const exists = this.types().some((item) => item.id === type.id);
    this.types.update((all) =>
      exists ? all.map((item) => (item.id === type.id ? type : item)) : [...all, type],
    );
    if (exists) {
      this.payments.update((all) =>
        all.map((payment) =>
          payment.feeTypeId === type.id && !payment.paid
            ? { ...payment, amount: type.amount }
            : payment,
        ),
      );
    }
  }

  newType(): FeeType {
    return {
      id: `type-${this.nextId++}`,
      name: '',
      rule: 'manuell vergeben',
      auto: false,
      amount: 0,
      note: '',
    };
  }

  paymentsCsv(rows: Payment[]): string {
    const lines = [
      [
        'Person',
        'Zahler',
        'Beitragsart',
        'Betrag',
        'Status',
        'Zahlart',
        'Mahnstufe',
        'Verwendungszweck',
      ],
      ...rows.map((payment) => [
        payment.label,
        payment.payerName,
        this.feeName(payment.feeTypeId),
        euro(payment.amount),
        payment.paid ? `bezahlt am ${fullDate(payment.paidOn)}` : 'offen',
        payment.method,
        String(payment.dunning),
        this.purposeOf(payment),
      ]),
    ];
    return BOM + lines.map((line) => line.join(';')).join('\r\n');
  }

  /** Demo file with the structure of a SEPA direct debit; the bank data is invented. */
  sepaText(rows: Payment[]): string {
    const debits = rows.filter((payment) => payment.method === 'Lastschrift' && !payment.paid);
    const total = debits.reduce((sum, item) => sum + item.amount, 0);
    const head = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Demo, keine gültige SEPA-Datei -->\n<Document>\n  <CstmrDrctDbtInitn>\n    <NbOfTxs>${debits.length}</NbOfTxs>\n    <CtrlSum>${total.toFixed(2)}</CtrlSum>`;
    const body = debits
      .map(
        (payment) =>
          `    <DrctDbtTxInf>\n      <Amt>${payment.amount.toFixed(2)}</Amt>\n      <Dbtr>${payment.payerName}</Dbtr>\n      <RmtInf>${this.purposeOf(payment)}</RmtInf>\n    </DrctDbtTxInf>`,
      )
      .join('\n');
    return `${head}\n${body}\n  </CstmrDrctDbtInitn>\n</Document>\n`;
  }

  dunningMail(row: DunningRow): { subject: string; lines: string[] } {
    const { payment, level } = row;
    const days = level >= 2 ? this.settings().daysFromLevel2 : this.settings().daysLevel1;
    return {
      subject: `${level}. Mahnung Beitrag ${this.year}, ${this.purposeOf(payment)}`,
      lines: [
        `Guten Tag ${payment.payerName},`,
        `für ${payment.label} ist der Beitrag „${this.feeName(payment.feeTypeId)}“ seit dem ${fullDate(payment.dueDate)} offen. Bitte überweisen Sie den Betrag innerhalb von ${days} Tagen.`,
      ],
    };
  }
}
