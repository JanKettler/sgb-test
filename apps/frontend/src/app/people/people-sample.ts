import { addDays } from '../training/training-dates';
import { GroupId, Person } from '../training/training.models';
import {
  Member,
  PayAccount,
  Parent,
  Relation,
  birthYear,
  emptyAccount,
  emptyMember,
} from './people.models';

/**
 * Invented demo members, derived from the training demo people so that both modules show the
 * same names. The repository is public, so nothing here is real.
 */
export interface PeopleSample {
  members: Member[];
  parents: Parent[];
}

const BASE_BIRTH: Record<GroupId, number> = { G1: 2016, G2: 2014, G3: 2012, WK: 2010, MA: 1985 };
/** Days from today until the certificate expires; null means nothing on file. */
const ATTEST_DAYS = [400, 21, 250, 69, 180, null, 500, -30, 320, 44, 610];
const FIRST_AID_DAYS = [700, -42, 400, 120];
const LIFE_SAVING_DAYS = [44, 380, 900, 250];
const LICENSE_DAYS = [900, 700, 1200, 500];
const LICENSE_KINDS = ['Trainer C Breitensport', 'Trainer C', 'Breitensport', 'Helfer'];
const MOTHERS = ['Claudia', 'Sabine', 'Nicole', 'Katja', 'Birgit', 'Jana', 'Petra', 'Kerstin'];
const FATHERS = ['Markus', 'Thomas', 'Stefan', 'Andreas', 'Michael', 'Frank'];
const REFEREES: Record<string, number> = { 't-anna': 60, 'p-katrin': 410, 'p-stefan': 150 };
const OFFICIALS: Record<string, string> = { 'p-stefan': 'Pressewart', 't-tobias': 'Schriftführer' };

function inDays(today: string, days: number | null): string {
  return days === null ? '' : addDays(today, days);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

const MALE = new Set([
  'Mats',
  'Emil',
  'Paul',
  'Felix',
  'Jannik',
  'Ben',
  'Oskar',
  'Leon',
  'Finn',
  'Noah',
  'Theo',
  'Jonte',
  'Max',
  'Ole',
  'Stefan',
  'Holger',
  'Jonas',
  'Tobias',
  'Lukas',
  'Tim',
]);

function buildMember(person: Person, index: number, today: string): Member {
  const [firstName, ...rest] = person.name.split(' ');
  const member = emptyMember(person.id, 40 + index * 7, today);
  const trainerNo = person.trainerGroupIds.length > 0 ? index : -1;
  const birth =
    person.groupId && person.trainerGroupIds.length === 0
      ? BASE_BIRTH[person.groupId] - (index % 3)
      : 1990 - index * 3;
  // Competition swimmers are not only the ones in the WK group.
  const starts =
    person.groupId !== null &&
    (person.groupId === 'WK' || person.groupId === 'MA' || index % 5 === 0);
  Object.assign(member, {
    firstName,
    lastName: rest.join(' '),
    sex: MALE.has(firstName) ? 'M' : 'W',
    birthDate: `${birth}-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + ((index * 5) % 28)).padStart(2, '0')}`,
    entry: `${2014 + (index % 10)}-09-01`,
    swimmer: person.groupId !== null,
    swimmerGroupIds: person.groupId ? [person.groupId] : [],
    dsvId: person.groupId ? String(377000 + index * 13) : '',
    competes: starts,
    attestUntil: starts ? inDays(today, ATTEST_DAYS[index % ATTEST_DAYS.length]) : '',
  } satisfies Partial<Member>);
  if (trainerNo >= 0) {
    Object.assign(member, {
      trainer: true,
      trainerGroupIds: person.trainerGroupIds,
      licenseKind: LICENSE_KINDS[trainerNo % 4],
      licenseNo: `1.B40.005.00${380 + trainerNo}`,
      licenseUntil: inDays(today, LICENSE_DAYS[trainerNo % 4]),
      firstAidUntil: inDays(today, FIRST_AID_DAYS[trainerNo % 4]),
      lifeSavingUntil: inDays(today, LIFE_SAVING_DAYS[trainerNo % 4]),
      criminalRecordOn: trainerNo === 2 ? '' : addDays(today, -400),
      fee: '15,00',
    } satisfies Partial<Member>);
  }
  const refereeDays = REFEREES[person.id];
  if (refereeDays !== undefined) {
    Object.assign(member, {
      referee: true,
      refereeNo: `KR-${100 + index}`,
      refereeUntil: inDays(today, refereeDays),
      criminalRecordOn: member.criminalRecordOn || addDays(today, -300),
    } satisfies Partial<Member>);
  }
  const role = OFFICIALS[person.id];
  if (role) {
    Object.assign(member, {
      official: true,
      officialFunction: role,
      criminalRecordOn: member.criminalRecordOn || addDays(today, -200),
    } satisfies Partial<Member>);
  }
  if (member.swimmer) member.startRight = 'DSV, Landesverband Niedersachsen';
  if (member.trainer) {
    member.codeOfConductOn = trainerNo % 3 === 1 ? '' : addDays(today, -600);
    member.appRoles = ['trainer'];
  }
  if (member.referee) {
    member.refereeAwUntil = addDays(today, 400 + index);
    member.refereeSchUntil = addDays(today, 300 + index);
  }
  const streets = ['Musterweg', 'Lindenallee', 'Am Sportplatz', 'Birkenstraße', 'Gartenweg'];
  Object.assign(member, {
    street: streets[index % streets.length],
    houseNo: String(2 + ((index * 3) % 40)),
    zip: '49406',
    city: 'Barnstorf',
    email1: birthYear(member) < 2008 ? `${slug(firstName)}.${slug(rest.join(''))}@example.org` : '',
    phone1: `05442 ${String(100000 + index * 137).slice(0, 6)}`,
  } satisfies Partial<Member>);
  if (member.official) {
    member.officialSince = addDays(today, -700 - index);
    member.officialUntil = addDays(today, 365 + index);
  }
  if (member.official) member.appRoles = [...member.appRoles, 'board'];
  if (member.trainer || member.official) {
    member.username = `${slug(firstName)}.${slug(rest.join(''))}`;
    member.loginEmail = `${member.username}@example.org`;
    member.access = 'active';
  }
  if (member.trainer) {
    member.material = [
      { id: `${person.id}-mat-1`, name: 'Vereinsjacke', since: `${2018 + (index % 6)}-10-01` },
    ];
  }
  return member;
}

/** Children with the same family name share their parents; everybody else gets one parent. */
function sampleAccount(
  firstName: string,
  lastName: string,
  counter: number,
  position: number,
  today: string,
): PayAccount {
  const direct = (counter + position) % 3 !== 2;
  if (!direct) return { ...emptyAccount(), holder: `${firstName} ${lastName}` };
  return {
    method: 'Lastschrift',
    holder: `${firstName} ${lastName}`,
    iban: `DE00 0000 0000 ${String(1000 + counter * 7).padStart(4, '0')} 0000 ${String(10 + position).padStart(2, '0')}`,
    bic: 'TESTDE00XXX',
    bank: 'Testbank',
    mandate: true,
    mandateRef: `M-${2000 + counter * 3 + position}`,
    mandateOn: addDays(today, -400 - counter),
  };
}

function buildParents(members: Member[], today: string): Parent[] {
  const parents: Parent[] = [];
  const families = new Map<string, Member[]>();
  for (const member of members) {
    if (!member.swimmer || birthYear(member) < 2008) continue;
    families.set(member.lastName, [...(families.get(member.lastName) ?? []), member]);
  }
  let counter = 0;
  for (const [lastName, children] of families) {
    const names: [Relation, string][] = [['Mutter', MOTHERS[counter % MOTHERS.length]]];
    if (children.length > 1) names.push(['Vater', FATHERS[counter % FATHERS.length]]);
    names.forEach(([relation, firstName], position) => {
      const id = `e-${slug(lastName)}-${position + 1}`;
      parents.push({
        id,
        name: `${firstName} ${lastName}`,
        relation,
        email: `${slug(firstName)}.${slug(lastName)}@example.org`,
        memberNo: position === 0 && counter % 3 === 0 ? 7000 + counter : null,
        birthDate: '',
        entry: position === 0 && counter % 3 === 0 ? children[0].entry : '',
        exitDate: '',
        street: children[0].street,
        houseNo: children[0].houseNo,
        zip: children[0].zip,
        city: children[0].city,
        email2: '',
        phone1: children[0].phone1,
        phone2: '',
        access: position === 0 ? 'active' : 'invited',
        trainingRegistration: true,
        competitionRegistration: position === 0,
        account: sampleAccount(firstName, lastName, counter, position, today),
      });
      for (const child of children) child.parentIds.push(id);
    });
    counter++;
  }
  return parents;
}

export function createPeopleSample(today: string, people: Person[]): PeopleSample {
  const members = people.map((person, index) => buildMember(person, index, today));
  return { members, parents: buildParents(members, today) };
}
