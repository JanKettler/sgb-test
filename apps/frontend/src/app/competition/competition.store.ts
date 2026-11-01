import { Injectable, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { addDays } from '../training/training-dates';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import {
  CompEvent,
  Competition,
  Decline,
  Entry,
  dateOf,
  euro,
  eventLabel,
  yearFits,
} from './competition.models';
import { FileClub, buildEntryFile, decodeDsv7, entryFileName, parseDsv7 } from './dsv7';
import { createZip } from './zip';

/** The club as it appears in the entry file; editable in the settings later. */
const CLUB: FileClub = {
  name: 'SG Barnstorf',
  dsvClubId: '0',
  stateId: '9',
  contactName: 'Mustermann, Max',
  contactStreet: 'Musterstraße 1',
  contactZip: '49406',
  contactCity: 'Barnstorf',
  contactMail: 'meldungen@example.org',
};

export interface StarterRow {
  personId: string;
  name: string;
  entries: Entry[];
  issues: string[];
  fee: number;
}

export interface ImportResult {
  id: string;
  warnings: string[];
}

function sampleEvents(): CompEvent[] {
  const list: CompEvent[] = [];
  let no = 1;
  const add = (distance: number, stroke: CompEvent['stroke'], fee: number, count = 1) => {
    for (const sex of count > 1 ? (['X'] as const) : (['M', 'W'] as const)) {
      list.push({
        no: no++,
        section: no <= 7 ? 1 : 2,
        count,
        distance,
        stroke,
        style: 'GL',
        sex,
        birthYears: 'offen',
        fee,
      });
    }
  };
  add(50, 'F', 5);
  add(100, 'F', 5);
  add(50, 'R', 5);
  add(50, 'B', 5);
  add(50, 'S', 5);
  add(50, 'F', 8, 4);
  return list;
}

function sampleMeet(
  id: string,
  title: string,
  place: string,
  venue: string,
  inDays: number,
  groupIds: GroupId[],
  open: boolean,
  today: string,
): Competition {
  const date = addDays(today, inDays);
  return {
    id,
    title,
    place,
    pool: 25,
    timing: 'HANDZEIT',
    venueName: venue,
    venueStreet: 'Badstraße 1',
    venueZip: '26121',
    venueCity: place,
    organiser: 'Beispielverein e. V.',
    host: 'Beispielverein e. V.',
    contactName: 'Meldestelle Beispielverein',
    contactEmail: 'meldungen@beispielverein.example',
    contactPhone: '',
    note: '',
    deadline: addDays(date, -10),
    deadlineTime: '23:59',
    internalDeadline: addDays(date, -14),
    open,
    groupIds,
    flatFee: 0,
    perSwimmerFee: 0,
    discount: 0,
    bank: {
      holder: 'Beispielverein e. V.',
      bank: 'Beispielbank',
      iban: 'DE00 0000 0000 0000 0000 00',
      bic: 'BEISPDE00XXX',
    },
    sent: false,
    sections: [
      {
        no: 1,
        date,
        entry: '09:00',
        warmup: '09:00',
        judges: '09:30',
        start: '10:00',
        relative: false,
      },
      {
        no: 2,
        date,
        entry: '00:00',
        warmup: '00:00',
        judges: '00:00',
        start: '01:00',
        relative: true,
      },
    ],
    events: sampleEvents(),
  };
}

/** In-memory stand-in for the future competition API. */
@Injectable({ providedIn: 'root' })
export class CompetitionStore {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  readonly today = this.training.today;
  readonly club = CLUB;
  private nextId = 4;

  readonly competitions = signal<Competition[]>([
    sampleMeet('c-1', 'Hunte-Pokal', 'Oldenburg', 'Hallenbad Oldenburg', 16, [], true, this.today),
    sampleMeet(
      'c-2',
      'Nikolausschwimmen',
      'Hunteholz',
      'Freizeitbad Hunteholz',
      40,
      [],
      false,
      this.today,
    ),
    sampleMeet(
      'c-3',
      'Bezirksmeisterschaften',
      'Bremen',
      'Sportbad Bremen',
      75,
      ['WK'],
      false,
      this.today,
    ),
  ]);
  readonly entries = signal<Entry[]>([
    ...[
      ['p-mats', 1, '00:31,20'],
      ['p-mats', 5, '00:36,40'],
      ['p-mats', 7, '00:41,10'],
      ['p-emil', 1, '00:30,85'],
      ['p-emil', 9, ''],
      ['p-nele', 2, '00:33,50'],
      ['p-nele', 4, '01:12,30'],
      ['p-nele', 8, '00:44,00'],
      ['p-paul', 3, '01:08,90'],
      ['p-sophie', 6, '00:38,20'],
      ['p-sophie', 10, '00:40,70'],
    ].map(([personId, eventNo, time]) => ({
      competitionId: 'c-1',
      personId: personId as string,
      eventNo: eventNo as number,
      time: time as string,
    })),
  ]);
  readonly declines = signal<Decline[]>([]);

  /** The persons the current demo user registers: the child(ren) of a parent, else the user. */
  readonly actors = this.training.actors;
  readonly canManage = this.training.canManage;

  competition(id: string | null): Competition | undefined {
    return this.competitions().find((item) => item.id === id);
  }

  /** Meets the actor may register for: open, and for their group. */
  visibleFor(personId: string): Competition[] {
    const member = this.people.member(personId);
    const groups = member?.swimmerGroupIds ?? [];
    return this.competitions()
      .filter(
        (item) =>
          item.open &&
          (item.groupIds.length === 0 || item.groupIds.some((group) => groups.includes(group))),
      )
      .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  }

  canRegister(competition: Competition): boolean {
    return competition.open && !competition.sent && this.today <= competition.internalDeadline;
  }

  entriesOf(competitionId: string, personId: string): Entry[] {
    return this.entries()
      .filter((item) => item.competitionId === competitionId && item.personId === personId)
      .sort((a, b) => a.eventNo - b.eventNo);
  }

  isDeclined(competitionId: string, personId: string): boolean {
    return this.declines().some(
      (item) => item.competitionId === competitionId && item.personId === personId,
    );
  }

  /** Replaces all starts of one person; an empty list removes the person from the meet. */
  setEntries(
    competitionId: string,
    personId: string,
    picks: { eventNo: number; time: string }[],
  ): void {
    this.entries.update((all) => [
      ...all.filter(
        (item) => !(item.competitionId === competitionId && item.personId === personId),
      ),
      ...picks.map((pick) => ({ competitionId, personId, ...pick })),
    ]);
    if (picks.length > 0) this.setDeclined(competitionId, personId, false);
  }

  setDeclined(competitionId: string, personId: string, declined: boolean): void {
    this.declines.update((all) => {
      const rest = all.filter(
        (item) => !(item.competitionId === competitionId && item.personId === personId),
      );
      return declined ? [...rest, { competitionId, personId }] : rest;
    });
    if (declined) this.setEntries(competitionId, personId, []);
  }

  nameOf(personId: string): string {
    const member = this.people.member(personId);
    return member ? `${member.firstName} ${member.lastName}` : personId;
  }

  /** Problems that would be flagged by the host or the DSV, in plain words. */
  issuesOf(competition: Competition, personId: string): string[] {
    const member = this.people.member(personId);
    const issues: string[] = [];
    if (!member) return ['Person nicht gefunden'];
    if (!member.dsvId) issues.push('DSV-Id fehlt');
    if (!member.attestUntil) issues.push('Sportattest fehlt');
    else if (member.attestUntil < dateOf(competition)) issues.push('Sportattest abgelaufen');
    const year = Number(member.birthDate.slice(0, 4));
    for (const entry of this.entriesOf(competition.id, personId)) {
      const event = competition.events.find((item) => item.no === entry.eventNo);
      if (!event) continue;
      if (!yearFits(event.birthYears, year)) issues.push(`Jahrgang passt nicht zu Wk ${event.no}`);
      if (event.sex !== 'X' && member.sex !== 'X' && event.sex !== member.sex) {
        issues.push(`Geschlecht passt nicht zu Wk ${event.no}`);
      }
    }
    return issues;
  }

  starters(competition: Competition): StarterRow[] {
    const ids = [
      ...new Set(
        this.entries()
          .filter((item) => item.competitionId === competition.id)
          .map((item) => item.personId),
      ),
    ];
    return ids
      .map((personId) => ({
        personId,
        name: this.nameOf(personId),
        entries: this.entriesOf(competition.id, personId),
        issues: this.issuesOf(competition, personId),
        fee: this.feeOf(competition, personId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  /** Entry fee of one person: the events plus the per-swimmer amount. */
  feeOf(competition: Competition, personId: string): number {
    const events = this.entriesOf(competition.id, personId).map((entry) =>
      competition.events.find((item) => item.no === entry.eventNo),
    );
    const sum = events.reduce((total, event) => total + (event?.fee ?? 0), 0);
    return events.length > 0 ? sum + competition.perSwimmerFee : 0;
  }

  /** All entry fees to be paid: events, per-swimmer amounts, flat fee, minus the discount. */
  totalFee(competition: Competition): number {
    const rows = this.starters(competition);
    const sum = rows.reduce((total, row) => total + row.fee, 0);
    return Math.max(0, sum + (rows.length > 0 ? competition.flatFee - competition.discount : 0));
  }

  counts(competition: Competition): { singles: number; relays: number; swimmers: number } {
    const mine = this.entries().filter((item) => item.competitionId === competition.id);
    const relayNos = new Set(
      competition.events.filter((item) => item.count > 1).map((item) => item.no),
    );
    return {
      singles: mine.filter((item) => !relayNos.has(item.eventNo)).length,
      relays: mine.filter((item) => relayNos.has(item.eventNo)).length,
      swimmers: new Set(mine.map((item) => item.personId)).size,
    };
  }

  save(competition: Competition): void {
    this.competitions.update((all) =>
      all.some((item) => item.id === competition.id)
        ? all.map((item) => (item.id === competition.id ? competition : item))
        : [...all, competition],
    );
  }

  create(): Competition {
    const date = addDays(this.today, 60);
    return {
      ...sampleMeet(`c-${this.nextId++}`, '', '', '', 60, [], false, this.today),
      sections: [{ no: 1, date, entry: '', warmup: '', judges: '', start: '', relative: false }],
      events: [],
      bank: { holder: '', bank: '', iban: '', bic: '' },
      organiser: '',
      host: '',
      contactName: '',
      contactEmail: '',
      venueName: '',
      venueStreet: '',
      venueZip: '',
    };
  }

  remove(id: string): void {
    this.competitions.update((all) => all.filter((item) => item.id !== id));
    this.entries.update((all) => all.filter((item) => item.competitionId !== id));
  }

  /** Creates a meet from an announcement or other DSV7 file; it stays closed until released. */
  importFile(bytes: ArrayBuffer): ImportResult | null {
    const { competition, warnings } = parseDsv7(decodeDsv7(bytes));
    if (!competition.title && competition.events.length === 0) return null;
    const id = `c-${this.nextId++}`;
    this.save({ ...competition, id });
    return { id, warnings };
  }

  /** The entry file as a ZIP, ready for the download. */
  entryZip(competition: Competition): { name: string; bytes: Uint8Array<ArrayBuffer> } {
    const rows = this.starters(competition);
    const swimmers = rows.flatMap((row) => {
      const member = this.people.member(row.personId);
      return member
        ? [
            {
              personId: row.personId,
              lastName: member.lastName,
              firstName: member.firstName,
              dsvId: member.dsvId,
              sex: member.sex,
              year: Number(member.birthDate.slice(0, 4)),
            },
          ]
        : [];
    });
    const base = entryFileName(competition, this.club.name);
    const text = buildEntryFile(
      competition,
      swimmers,
      this.entries().filter((item) => item.competitionId === competition.id),
      this.club,
      new Date(),
    );
    const bytes = createZip([{ name: `${base}.DSV7`, data: new TextEncoder().encode(text) }]);
    return { name: `${base}.zip`, bytes };
  }

  /** Mail text for the treasurer: how much to pay, to whom, and for which swimmers. */
  treasurerText(competition: Competition): string {
    const rows = this.starters(competition);
    const bank = competition.bank;
    const lines = [
      `Meldegeld für ${competition.title} (${competition.place})`,
      '',
      `Bitte überweise ${euro(this.totalFee(competition))} an:`,
      `${bank.holder}, ${bank.bank}`,
      `IBAN: ${bank.iban}`,
      `BIC: ${bank.bic}`,
      `Verwendungszweck: ${competition.title} ${this.club.name}`,
      `Überweisen bis: ${competition.deadline.split('-').reverse().join('.')}`,
      '',
      'Aufstellung:',
      ...rows.map((row) => `${row.name}: ${row.entries.length} Starts, ${euro(row.fee)}`),
    ];
    if (competition.flatFee > 0) lines.push(`Pauschale: ${euro(competition.flatFee)}`);
    if (competition.discount > 0) lines.push(`Rabatt: -${euro(competition.discount)}`);
    return lines.join('\n');
  }

  treasurerMail(): string {
    const member = this.people
      .members()
      .find((item) => item.appRoles.includes('treasurer') && item.email1);
    return member?.email1 ?? '';
  }

  eventLabel(event: CompEvent): string {
    return eventLabel(event);
  }
}
