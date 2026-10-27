import { GroupId } from '../training/training.models';

/** A club member. One person can be swimmer, trainer, referee and official at once. */
export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  memberNo: number;
  /** ISO date, yyyy-MM-dd */
  entry: string;
  active: boolean;
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

export function initials(member: Pick<Member, 'firstName' | 'lastName'>): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

export function emptyMember(id: string, memberNo: number, today: string): Member {
  return {
    id,
    firstName: '',
    lastName: '',
    birthYear: Number(today.slice(0, 4)) - 10,
    memberNo,
    entry: today,
    active: true,
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
  };
}
