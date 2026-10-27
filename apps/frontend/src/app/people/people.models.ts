import { GroupId } from '../training/training.models';

/** A club member. One person can be swimmer, trainer, referee and official at once. */
export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO date, yyyy-MM-dd */
  birthDate: string;
  memberNo: number;
  /** ISO date, yyyy-MM-dd */
  entry: string;
  /** Set automatically on saving, see isActive(). */
  active: boolean;
  /** ISO date of leaving the club; empty while still a member. */
  exitDate: string;
  /** Date of the police clearance certificate; needed once per person. */
  criminalRecordOn: string;
  swimmer: boolean;
  swimmerGroupIds: GroupId[];
  dsvId: string;
  attestUntil: string;
  trainer: boolean;
  trainerGroupIds: GroupId[];
  licenseKind: string;
  licenseNo: string;
  licenseUntil: string;
  firstAidUntil: string;
  lifeSavingUntil: string;
  fee: string;
  iban: string;
  bic: string;
  referee: boolean;
  refereeNo: string;
  refereeUntil: string;
  official: boolean;
  officialFunction: string;
  parentIds: string[];
  /** Start right (Startrecht) with the DSV, free text. */
  startRight: string;
  /** Date the code of conduct (Ehrenkodex) was signed. */
  codeOfConductOn: string;
  refereeAwUntil: string;
  refereeSchUntil: string;
  /** Portal login. */
  username: string;
  loginEmail: string;
  access: 'none' | 'active' | 'blocked';
  appRoles: AppRoleKey[];
  specialRights: SpecialRightKey[];
  material: MaterialItem[];
  extra: ExtraField[];
  account: PayAccount;
}

export interface MaterialItem {
  id: string;
  name: string;
  /** ISO date of handing out */
  since: string;
}

export interface ExtraField {
  id: string;
  label: string;
  value: string;
}

export type AppRoleKey = 'trainer' | 'board' | 'management' | 'treasurer' | 'youth' | 'helper';

/** Same roles as the user administration; changes apply in both places. */
export const APP_ROLES: readonly { key: AppRoleKey; label: string; hint: string }[] = [
  {
    key: 'trainer',
    label: 'Trainer aus Mitgliederliste',
    hint: 'WK-Gruppe, Training, Wettkämpfe, eigene Abrechnung und Fahrten',
  },
  { key: 'board', label: 'Vorstand', hint: 'Anträge, Sitzungen, Protokolle und Beschlüsse' },
  {
    key: 'management',
    label: 'Geschäftsführung',
    hint: 'Aufgaben, Wettkämpfe, Training, Veranstaltungen, Material',
  },
  { key: 'treasurer', label: 'Kassenwart', hint: 'Abrechnungen und Fahrten prüfen und bezahlen' },
  { key: 'youth', label: 'Jugendvertretung', hint: 'Schwimmabzeichen und Veranstaltungen' },
  { key: 'helper', label: 'Helfer', hint: 'Eigene Aufgaben, Wettkampf- und Veranstaltungshilfe' },
];

export type SpecialRightKey = 'youthCash' | 'marketSale' | 'marketInventory';

export const SPECIAL_RIGHTS: readonly { key: SpecialRightKey; label: string; hint: string }[] = [
  {
    key: 'youthCash',
    label: 'JV | Kasse',
    hint: 'Jugendkasse: ansehen, buchen, bestätigen, verwalten und drucken',
  },
  {
    key: 'marketSale',
    label: 'Weihnachtsmarkt | Verkauf',
    hint: 'Seite Verkauf im Weihnachtsmarkt',
  },
  {
    key: 'marketInventory',
    label: 'Weihnachtsmarkt | Inventar pflegen',
    hint: 'Inventar, Bedarf und Lager bearbeiten',
  },
];

export type PayMethod = 'Lastschrift' | 'Überweisung';

/** How a payer pays the fees; stored with the person who pays. */
export interface PayAccount {
  method: PayMethod;
  holder: string;
  iban: string;
  bic: string;
  bank: string;
  mandate: boolean;
  mandateRef: string;
  /** ISO date the SEPA mandate was given */
  mandateOn: string;
}

export function emptyAccount(): PayAccount {
  return {
    method: 'Überweisung',
    holder: '',
    iban: '',
    bic: '',
    bank: '',
    mandate: false,
    mandateRef: '',
    mandateOn: '',
  };
}

export type Relation = 'Mutter' | 'Vater' | 'Erziehungsberechtigte';

/** Parents get their own login and register their children. */
export interface Parent {
  id: string;
  name: string;
  relation: Relation;
  email: string;
  access: 'active' | 'invited';
  trainingRegistration: boolean;
  competitionRegistration: boolean;
  account: PayAccount;
}

export type RoleKey = 'swimmer' | 'trainer' | 'referee' | 'official';

export const ROLES: readonly { key: RoleKey; label: string; css: string }[] = [
  { key: 'swimmer', label: 'Schwimmer', css: 'pill is-info' },
  { key: 'trainer', label: 'Trainer', css: 'pill is-ok' },
  { key: 'referee', label: 'Kampfrichter', css: 'pill is-warn' },
  { key: 'official', label: 'Funktionär', css: 'pill is-violet' },
];

export const LICENSE_KINDS: readonly string[] = [
  'Helfer',
  'Breitensport',
  'Trainer C',
  'Trainer C Breitensport',
];

export function fullName(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function birthYear(member: Pick<Member, 'birthDate'>): number {
  return Number(member.birthDate.slice(0, 4));
}

/**
 * A person counts as active while they hold at least one role (a swimmer needs a group) and
 * have not left the club yet.
 */
export function isActive(member: Member, today: string): boolean {
  const hasRole =
    (member.swimmer && member.swimmerGroupIds.length > 0) ||
    member.trainer ||
    member.referee ||
    member.official;
  return hasRole && (!member.exitDate || member.exitDate > today);
}

export function initials(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

export function emptyMember(id: string, memberNo: number, today: string): Member {
  return {
    id,
    firstName: '',
    lastName: '',
    birthDate: `${Number(today.slice(0, 4)) - 10}-01-01`,
    memberNo,
    entry: today,
    active: true,
    exitDate: '',
    criminalRecordOn: '',
    swimmer: true,
    swimmerGroupIds: [],
    dsvId: '',
    attestUntil: '',
    trainer: false,
    trainerGroupIds: [],
    licenseKind: '',
    licenseNo: '',
    licenseUntil: '',
    firstAidUntil: '',
    lifeSavingUntil: '',
    fee: '',
    iban: '',
    bic: '',
    referee: false,
    refereeNo: '',
    refereeUntil: '',
    official: false,
    officialFunction: '',
    parentIds: [],
    startRight: '',
    codeOfConductOn: '',
    refereeAwUntil: '',
    refereeSchUntil: '',
    username: '',
    loginEmail: '',
    access: 'none',
    appRoles: [],
    specialRights: [],
    material: [],
    extra: [],
    account: emptyAccount(),
  };
}
