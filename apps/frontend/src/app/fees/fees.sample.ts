import { addDays } from '../training/training-dates';
import { Member, Parent, birthYear, fullName } from '../people/people.models';
import { FeeSettings, FeeType, Payment } from './fees.models';

/** Invented demo data; the repository is public. */
export const SAMPLE_FEE_TYPES: FeeType[] = [
  {
    id: 'adult',
    name: 'Einzelmitglied ab 19 Jahre',
    rule: 'Jahrgang 2007 und älter',
    auto: true,
    amount: 72,
    note: 'Das Alter richtet sich nach dem Geburtsjahr und stellt sich jedes Jahr von selbst um.',
  },
  {
    id: 'youth',
    name: 'Einzelmitglied bis 18 Jahre',
    rule: 'Jahrgang 2008 und jünger',
    auto: true,
    amount: 60,
    note: 'Das Alter richtet sich nach dem Geburtsjahr und stellt sich jedes Jahr von selbst um.',
  },
  {
    id: 'siblings',
    name: '2 Mitglieder bis 18 Jahre',
    rule: 'zwei Geschwister, automatisch',
    auto: true,
    amount: 102,
    note: 'Zwei Geschwister mit denselben Eltern zahlen gemeinsam.',
  },
  {
    id: 'family',
    name: 'Familie',
    rule: 'ab 3 Mitgliedern, automatisch',
    auto: true,
    amount: 132,
    note: 'Eine Familie zählt ab 3 Mitgliedern. Der Name ist der Familienname des Zahlers, die Mitglieder rechnen sich selbst dazu.',
  },
  {
    id: 'passive',
    name: 'Passiv',
    rule: 'manuell vergeben',
    auto: false,
    amount: 30,
    note: 'Passive Mitglieder werden von Hand zugeordnet.',
  },
];

export const SAMPLE_SETTINGS: FeeSettings = {
  feeLevel1: 0,
  feeFromLevel2: 5,
  daysLevel1: 10,
  daysFromLevel2: 21,
  copyTo: '',
  remindDebit: true,
  remindTransfer: true,
  purposeTemplate: '[NACHNAME] [MITGLIEDNR], [JAHR] [BEITRAGNAME]',
  accountHolder: 'Schwimmgemeinschaft Barnstorf',
  bank: 'Testbank',
  iban: '',
  bic: '',
  creditorId: '',
};

const PASSIVE = ['Ute Hartmann', 'Wilfried Brandes', 'Rosi Kaiser'];

export function feeTypeFor(
  member: Pick<Member, 'birthDate'>,
  year: number,
  groupSize: number,
  groupAllYouth: boolean,
): string {
  if (groupSize >= 3) return 'family';
  if (groupSize === 2 && groupAllYouth) return 'siblings';
  return birthYear(member) <= year - 19 ? 'adult' : 'youth';
}

/** Fee type and list label for a group of members that pay together. */
export function describeGroup(group: Member[], year: number): { typeId: string; label: string } {
  const youth = group.every((member) => birthYear(member) > year - 19);
  return {
    typeId: feeTypeFor(group[0], year, group.length, youth),
    label:
      group.length >= 3
        ? `Familie ${group[0].lastName} (${group.map((member) => member.firstName).join(', ')})`
        : group.map((member) => fullName(member)).join(', '),
  };
}

/** Builds one payment per paying household for the current year. */
export function createPaymentSample(
  today: string,
  members: Member[],
  parents: Parent[],
  types: FeeType[],
): Payment[] {
  const year = Number(today.slice(0, 4));
  const due = `${year}-02-15`;
  const amountOf = (id: string) => types.find((type) => type.id === id)?.amount ?? 0;
  const households = new Map<string, Member[]>();
  for (const member of members) {
    const key = member.parentIds.length ? [...member.parentIds].sort().join('+') : member.id;
    households.set(key, [...(households.get(key) ?? []), member]);
  }
  const payments: Payment[] = [];
  let index = 0;
  for (const group of households.values()) {
    const first = group[0];
    const parent = parents.find((item) => item.id === first.parentIds[0]);
    const { typeId, label } = describeGroup(group, year);
    const method = parent?.account.method ?? 'Überweisung';
    payments.push({
      id: `z-${index}`,
      memberIds: group.map((member) => member.id),
      label,
      payerId: parent?.id ?? first.id,
      payerName: parent?.name ?? fullName(first),
      feeTypeId: typeId,
      amount: amountOf(typeId),
      method,
      dueDate: due,
      paid: true,
      paidOn: addDays(due, 3 + (index % 9)),
      dunning: 0,
      purpose: '',
    });
    index++;
  }
  PASSIVE.forEach((name, position) => {
    payments.push({
      id: `z-p${position}`,
      memberIds: [],
      label: name,
      payerId: `passive-${position}`,
      payerName: name,
      feeTypeId: 'passive',
      amount: amountOf('passive'),
      method: 'Überweisung',
      dueDate: due,
      paid: position === 2,
      paidOn: position === 2 ? addDays(due, 12) : '',
      dunning: position === 0 ? 1 : 0,
      purpose: '',
    });
  });
  // A few open payments, one of them already reminded once.
  [4, 9, 14].forEach((at, position) => {
    const payment = payments[at];
    if (!payment) return;
    payment.paid = false;
    payment.paidOn = '';
    payment.dunning = position === 1 ? 1 : 0;
  });
  return payments;
}
