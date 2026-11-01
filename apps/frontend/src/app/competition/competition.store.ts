import { Injectable, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { addDays } from '../training/training-dates';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import {
  CompEvent,
  Competition,
  Decline,
  Entry,
  RelayEntry,
  RunResult,
  emptyPlan,
  emptyResult,
  emptySchedule,
  sameName,
  startKey,
  FeeStatus,
  Participation,
  PHASES,
  dateOf,
  euro,
  eventLabel,
  eventTitle,
  yearFits,
  normalizeTime,
  timeMs,
} from './competition.models';
import {
  FileClub,
  FileSwimmer,
  buildControlSheet,
  buildEntryFile,
  decodeDsv7,
  entryFileName,
  parseDsv7,
} from './dsv7';
import { createZip } from './zip';
import { ParsedResults, ParsedSchedule } from './wk-parse';

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

/** A mail the portal "sent". The test portal has no mail server yet, so it only keeps them. */
export interface SentMail {
  id: number;
  at: string;
  competitionId: string;
  to: string;
  cc: string;
  subject: string;
  html: string;
  attachments: string[];
}

/** What the mail dialog starts with. */
export interface MailDraft {
  to: string;
  cc: string;
  subject: string;
  html: string;
  attachments: string[];
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
    officials: {},
    coaches: {},
    plan: emptyPlan(),
    schedule: emptySchedule(),
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
  readonly relays = signal<RelayEntry[]>([
    {
      competitionId: 'c-1',
      eventNo: 11,
      team: 1,
      year: 2012,
      time: '02:15,00',
      memberIds: ['p-mats', 'p-emil', 'p-nele', 'p-sophie'],
    },
  ]);
  readonly declines = signal<Decline[]>([]);
  readonly outbox = signal<SentMail[]>([]);
  private nextMail = 1;

  /** The persons the current demo user registers: the child(ren) of a parent, else the user. */
  readonly actors = this.training.actors;
  readonly canManage = this.training.canManage;

  /** Single entries: trainers and the board always; swimmers and parents for their own persons until the internal deadline. */
  canEditEntries(competition: Competition, personId: string): boolean {
    if (this.canManage()) return true;
    return this.actors().some((person) => person.id === personId) && this.canRegister(competition);
  }

  /** Relay teams are put together by trainers and the board only. */
  canEditRelays(): boolean {
    return this.canManage();
  }

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

  /** Meets for the calendar: all for trainers and the board, else those of the user's groups. */
  calendarMeets(): Competition[] {
    if (this.canManage()) return this.competitions();
    const groups = new Set(
      this.actors().flatMap((person) => this.people.member(person.id)?.swimmerGroupIds ?? []),
    );
    return this.competitions().filter(
      (item) => item.groupIds.length === 0 || item.groupIds.some((group) => groups.has(group)),
    );
  }

  canRegister(competition: Competition): boolean {
    return competition.open && !competition.sent && this.today <= competition.internalDeadline;
  }

  entriesOf(competitionId: string, personId: string): Entry[] {
    return this.entries()
      .filter((item) => item.competitionId === competitionId && item.personId === personId)
      .sort((a, b) => a.eventNo - b.eventNo);
  }

  /**
   * The time to suggest as entry time: the best result of the person over the same distance and
   * stroke, else the best entry time they used before. Empty when nothing is known.
   */
  knownTime(personId: string, competition: Competition, event: CompEvent): string {
    const sameEvent = (other: CompEvent | undefined) =>
      !!other &&
      other.count === 1 &&
      other.distance === event.distance &&
      other.stroke === event.stroke &&
      other.style === event.style;
    const best = (times: string[]) =>
      times
        .map((time) => ({ time, ms: timeMs(time) }))
        .filter((item): item is { time: string; ms: number } => !!item.ms)
        .sort((a, b) => a.ms - b.ms)[0]?.time ?? '';
    const name = this.nameOf(personId);
    const results: string[] = [];
    for (const meet of this.competitions()) {
      if (meet.id === competition.id) continue;
      for (const start of meet.schedule.starts) {
        if (!sameName(start.n, name) || !sameEvent(meet.events.find((e) => e.no === start.e))) {
          continue;
        }
        const result = meet.schedule.results[startKey(start)];
        const time = result && !result.status ? normalizeTime(result.t) : null;
        if (time) results.push(time);
      }
    }
    const fromResults = best(results);
    if (fromResults) return fromResults;
    return best(
      this.entries()
        .filter((item) => item.personId === personId && item.competitionId !== competition.id)
        .filter((item) =>
          sameEvent(
            this.competition(item.competitionId)?.events.find((e) => e.no === item.eventNo),
          ),
        )
        .map((item) => item.time),
    );
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

  relaysOf(competitionId: string): RelayEntry[] {
    return this.relays()
      .filter((item) => item.competitionId === competitionId)
      .sort((a, b) => a.eventNo - b.eventNo || a.team - b.team);
  }

  /** Saves a relay team; `previous` is the team as it was when editing started. */
  saveRelay(relay: RelayEntry, previous?: RelayEntry): void {
    this.relays.update((all) => [...all.filter((item) => item !== previous), relay]);
  }

  removeRelay(relay: RelayEntry): void {
    this.relays.update((all) => all.filter((item) => item !== relay));
  }

  /** Problems of a relay team: wrong number of swimmers, sex or age that does not fit. */
  relayIssues(competition: Competition, relay: RelayEntry): string[] {
    const event = competition.events.find((item) => item.no === relay.eventNo);
    const issues: string[] = [];
    if (!event) return ['Wettkampf nicht gefunden'];
    if (relay.memberIds.length !== event.count) {
      issues.push(`${event.count} Schwimmer nötig, ${relay.memberIds.length} eingetragen`);
    }
    for (const id of relay.memberIds) {
      const member = this.people.member(id);
      if (!member) continue;
      const name = `${member.firstName} ${member.lastName}`;
      if (event.sex !== 'X' && member.sex !== 'X' && event.sex !== member.sex) {
        issues.push(`${name}: Geschlecht passt nicht`);
      }
      if (!yearFits(event.birthYears, Number(member.birthDate.slice(0, 4)))) {
        issues.push(`${name}: Jahrgang passt nicht`);
      }
    }
    return issues;
  }

  /** Persons who can swim in a relay: active members who compete. */
  relayCandidates(): { id: string; name: string }[] {
    return this.people
      .members()
      .filter((member) => member.swimmer && member.competes && member.active)
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  /** Active members who may be named as judge or coach. */
  staffCandidates(): { id: string; name: string }[] {
    return this.people
      .members()
      .filter((member) => member.active)
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
    const relayFees = this.relaysOf(competition.id).reduce(
      (total, relay) =>
        total + (competition.events.find((event) => event.no === relay.eventNo)?.fee ?? 0),
      0,
    );
    const sum = rows.reduce((total, row) => total + row.fee, 0) + relayFees;
    const any = rows.length > 0 || relayFees > 0;
    return Math.max(0, sum + (any ? competition.flatFee - competition.discount : 0));
  }

  counts(competition: Competition): { singles: number; relays: number; swimmers: number } {
    const mine = this.entries().filter((item) => item.competitionId === competition.id);
    return {
      singles: mine.length,
      relays: this.relaysOf(competition.id).length,
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
    this.relays.update((all) => all.filter((item) => item.competitionId !== id));
  }

  /** Creates a meet from an announcement or other DSV7 file; it stays closed until released. */
  importFile(bytes: ArrayBuffer): ImportResult | null {
    const { competition, warnings } = parseDsv7(decodeDsv7(bytes));
    if (!competition.title && competition.events.length === 0) return null;
    const id = `c-${this.nextId++}`;
    this.save({ ...competition, id });
    return { id, warnings };
  }

  private fileSwimmers(competition: Competition): FileSwimmer[] {
    return this.starters(competition).flatMap((row) => {
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
  }

  /** File base name and the texts of the entry file and the control sheet. */
  entryFiles(competition: Competition): { base: string; entryFile: string; control: string } {
    const swimmers = this.fileSwimmers(competition);
    const entries = this.entries().filter((item) => item.competitionId === competition.id);
    const relays = this.relaysOf(competition.id);
    return {
      base: entryFileName(competition, this.club.name),
      entryFile: buildEntryFile(competition, swimmers, entries, this.club, new Date(), relays),
      control: buildControlSheet(competition, swimmers, entries, relays, this.club),
    };
  }

  /** Download of the entries: entry file and control sheet in one ZIP, or one of them alone. */
  entryDownload(
    competition: Competition,
    kind: 'zip' | 'dsv7' | 'control',
  ): { name: string; bytes: Uint8Array<ArrayBuffer>; type: string } {
    const { base, entryFile, control } = this.entryFiles(competition);
    const encode = (text: string) => new TextEncoder().encode(text);
    if (kind === 'dsv7') {
      return { name: `${base}.DSV7`, bytes: encode(entryFile), type: 'text/plain' };
    }
    if (kind === 'control') {
      return { name: `Kontrolle_${base}.txt`, bytes: encode(control), type: 'text/plain' };
    }
    return {
      name: `${base}.zip`,
      bytes: createZip([
        { name: `${base}.DSV7`, data: encode(entryFile) },
        { name: `Kontrolle_${base}.txt`, data: encode(control) },
      ]),
      type: 'application/zip',
    };
  }

  private germanDate(iso: string): string {
    return iso.split('-').reverse().join('.');
  }

  /** The mail to the host with the entry file; the person may edit it before sending. */
  entryMailDraft(competition: Competition): MailDraft {
    const when = `${this.germanDate(dateOf(competition))} in ${competition.place}`;
    const counts = this.counts(competition);
    return {
      to: competition.contactEmail,
      cc: this.club.contactMail,
      subject: `Meldung ${this.club.name}: ${competition.title}`,
      html: [
        `<p>Guten Tag${competition.contactName ? ` ${this.firstName(competition.contactName)}` : ''},</p>`,
        `<p>anbei die Meldung der ${this.club.name} für „${competition.title}“ am ${when}: ${counts.swimmers} Schwimmer, ${counts.singles} Einzel- und ${counts.relays} Staffelstarts.</p>`,
        `<p>Das Meldegeld von ${euro(this.totalFee(competition))} überweisen wir fristgerecht.</p>`,
        `<p>Mit sportlichem Gruß<br>${this.signature()}</p>`,
      ].join(''),
      attachments: [this.entryDownload(competition, 'zip').name],
    };
  }

  /** The mail to the treasurer: how much to pay, to whom, for which meet. */
  treasurerMailDraft(competition: Competition): MailDraft {
    const bank = competition.bank;
    const when = `${this.germanDate(dateOf(competition))} in ${competition.place}`;
    const treasurer = this.treasurer();
    return {
      to: treasurer?.email1 ?? '',
      cc: '',
      subject: `Meldegeld ${competition.title}`,
      html: [
        `<p>Hallo${treasurer ? ` ${treasurer.firstName}` : ''},</p>`,
        `<p>unsere Meldungen von ${this.club.name} für die Veranstaltung „${competition.title}“ ${when} sind verschickt. Bitte überweise das zu zahlende Meldegeld.</p>`,
        `<p>Kontoinhaber: ${bank.holder}<br>Bank: ${bank.bank}<br>IBAN: <b>${bank.iban}</b><br>BIC: ${bank.bic}<br>Höhe Meldegeld: <b>${euro(this.totalFee(competition))}</b><br>Verwendungszweck: Meldegeld ${competition.title} ${this.club.name}<br>Überweisen bis: ${this.germanDate(competition.deadline)}</p>`,
        `<p>Bitte kurze Rückinfo, wenn es überwiesen ist.</p>`,
        `<p>Mit sportlichem Gruß<br>${this.signature()}</p>`,
      ].join(''),
      attachments: [],
    };
  }

  /** "Mustermann, Max" -> "Max". */
  private firstName(name: string): string {
    const parts = name.split(',').map((part) => part.trim());
    return parts[1] || parts[0];
  }

  private signature(): string {
    return this.firstName(this.club.contactName);
  }

  private treasurer() {
    return this.people.members().find((item) => item.appRoles.includes('treasurer') && item.email1);
  }

  // ---- Checklist -------------------------------------------------------------------------

  private patchPlan(id: string, change: (plan: Competition['plan']) => Competition['plan']): void {
    this.competitions.update((all) =>
      all.map((item) => (item.id === id ? { ...item, plan: change(item.plan) } : item)),
    );
  }

  private userName(): string {
    const person = this.actors()[0];
    return person ? this.nameOf(person.id) : 'Du';
  }

  isStepDone(competition: Competition, step: string): boolean {
    return !!competition.plan.done[step] || (step === 'sent' && competition.sent);
  }

  /** Ticks or unticks a step; "Meldungen versendet" also locks the registration. */
  toggleStep(id: string, step: string): void {
    const item = this.competition(id);
    if (!item) return;
    const on = this.isStepDone(item, step);
    this.patchPlan(id, (plan) => {
      const done = { ...plan.done };
      if (on) delete done[step];
      else done[step] = { by: this.userName(), at: this.today };
      return { ...plan, done };
    });
    if (step === 'sent') this.save({ ...this.competition(id)!, sent: !on });
  }

  setFeeStatus(id: string, fee: FeeStatus): void {
    this.patchPlan(id, (plan) => ({ ...plan, fee }));
  }

  setParticipation(id: string, participation: Participation): void {
    this.patchPlan(id, (plan) => ({ ...plan, participation }));
  }

  setJudges(id: string, section: number, count: number | null): void {
    this.patchPlan(id, (plan) => ({ ...plan, judges: { ...plan.judges, [section]: count } }));
  }

  /** Steps done of all steps (the fee counts as one when paid). */
  progress(competition: Competition): { done: number; total: number } {
    const steps = PHASES.flatMap((phase) => phase.items.map((item) => item[0]));
    const done = steps.filter((step) => this.isStepDone(competition, step)).length;
    return {
      done: done + (competition.plan.fee === 'paid' ? 1 : 0),
      total: steps.length + 1,
    };
  }

  daysTo(iso: string): number {
    return Math.round(
      (Date.parse(`${iso}T12:00:00`) - Date.parse(`${this.today}T12:00:00`)) / 864e5,
    );
  }

  /** Slots of the host's judge panel nobody is named for yet. */
  openDuties(competition: Competition): number {
    return competition.schedule.duties.filter((duty) => !duty.name || /^N\s?N$/i.test(duty.name))
      .length;
  }

  /** What needs attention soon: deadlines and open judge slots. */
  warnings(competition: Competition): { tone: 'bad' | 'warn'; text: string }[] {
    const out: { tone: 'bad' | 'warn'; text: string }[] = [];
    if (dateOf(competition) < this.today) return out;
    const sent = this.isStepDone(competition, 'sent');
    const date = (iso: string) => iso.split('-').reverse().join('.');
    const when = (days: number) =>
      days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`;
    if (competition.deadline && !sent) {
      const days = this.daysTo(competition.deadline);
      if (days < 0)
        out.push({ tone: 'bad', text: `Meldeschluss vorbei (${date(competition.deadline)})` });
      else if (days <= 7)
        out.push({ tone: days <= 2 ? 'bad' : 'warn', text: `Meldeschluss ${when(days)}` });
    }
    if (competition.internalDeadline && !sent && !this.isStepDone(competition, 'checked')) {
      const days = this.daysTo(competition.internalDeadline);
      if (days < 0) out.push({ tone: 'bad', text: 'Interner Meldeschluss überschritten' });
      else if (days <= 3) out.push({ tone: 'warn', text: `Interner Meldeschluss ${when(days)}` });
    }
    const open = this.openDuties(competition);
    if (open > 0) {
      out.push({
        tone: 'warn',
        text: `${open} Kampfgericht-${open > 1 ? 'Plätze' : 'Platz'} offen`,
      });
    }
    return out;
  }

  // ---- Meldeergebnis and results ---------------------------------------------------------

  private patchSchedule(
    id: string,
    change: (schedule: Competition['schedule']) => Competition['schedule'],
  ): void {
    this.competitions.update((all) =>
      all.map((item) => (item.id === id ? { ...item, schedule: change(item.schedule) } : item)),
    );
  }

  /** Takes starts, judge slots and event names from a Meldeergebnis; names already given stay. */
  importSchedule(id: string, parsed: ParsedSchedule): void {
    this.patchSchedule(id, (old) => ({
      ...old,
      starts: parsed.starts,
      duties: parsed.duties.map((duty) => {
        const before = old.duties.find(
          (item) => item.a === duty.a && item.pos === duty.pos && item.g === duty.g,
        );
        return before?.name && /^N\s?N$/i.test(duty.name) ? { ...duty, name: before.name } : duty;
      }),
      eventNames: parsed.eventNames,
      stand: parsed.stand,
    }));
  }

  /** Sets (a part of) the result of one start, as typed on the pool deck. */
  setResult(id: string, key: string, change: Partial<RunResult>): void {
    this.patchSchedule(id, (old) => {
      const next = { ...(old.results[key] ?? emptyResult()), ...change };
      const results = { ...old.results };
      if (!next.t && !next.status && !next.ok && next.sp.every((time) => !time))
        delete results[key];
      else results[key] = next;
      return { ...old, results };
    });
  }

  setNote(id: string, note: string): void {
    this.patchSchedule(id, (old) => ({ ...old, note }));
  }

  assignDuty(id: string, index: number, name: string): void {
    this.patchSchedule(id, (old) => ({
      ...old,
      duties: old.duties.map((duty, at) => (at === index ? { ...duty, name } : duty)),
    }));
  }

  /** Enters the results of a DSV7 result list; returns how many starts matched and were added. */
  importResults(
    id: string,
    parsed: ParsedResults,
    overwrite: boolean,
  ): { matched: number; added: number } {
    let matched = 0;
    let added = 0;
    this.patchSchedule(id, (old) => {
      const starts = [...old.starts];
      const results = { ...old.results };
      const lane = new Map<number, number>();
      for (const start of starts) lane.set(start.e, Math.max(lane.get(start.e) ?? 0, start.b));
      for (const found of parsed.found) {
        let start = starts.find((item) => item.e === found.e && sameName(item.n, found.swimmer));
        if (start) matched++;
        else {
          lane.set(found.e, (lane.get(found.e) ?? 0) + 1);
          start = {
            e: found.e,
            l: 1,
            lt: 1,
            t: '',
            b: lane.get(found.e) ?? 1,
            n: found.swimmer,
            s: '',
            j: found.year,
            m: '',
          };
          starts.push(start);
          added++;
        }
        const key = startKey(start);
        if (results[key] && (results[key].t || results[key].status) && !overwrite) continue;
        results[key] = {
          ...results[key],
          t: found.time,
          sp: found.splits,
          status: found.status,
          place: found.place,
          ageGroup: found.ageGroup,
        };
      }
      const names = { ...old.eventNames };
      for (const found of parsed.found) names[found.e] ??= found.name;
      const sections = new Set(parsed.judges.map((judge) => judge.section));
      const duties = [
        ...old.duties.filter((duty) => !sections.has(duty.a)),
        ...parsed.judges.map((judge) => ({
          a: judge.section,
          g: 'laut Protokoll',
          pos: judge.role,
          name: judge.name,
        })),
      ].sort((a, b) => a.a - b.a);
      return { ...old, starts, results, eventNames: names, duties, relayResults: parsed.relays };
    });
    const counts = new Map<number, Set<string>>();
    for (const judge of parsed.judges) {
      counts.set(judge.section, (counts.get(judge.section) ?? new Set()).add(judge.name));
    }
    for (const [section, names] of counts) this.setJudges(id, section, names.size);
    return { matched, added };
  }

  /** Name of an event: from the Meldeergebnis, else from the event list. */
  eventName(competition: Competition, no: number): string {
    return eventTitle(competition, no);
  }

  /** Keeps the mail in the outbox. A real mail server comes with the backend. */
  sendMail(competitionId: string, draft: MailDraft): void {
    this.outbox.update((all) => [
      ...all,
      { ...draft, id: this.nextMail++, at: new Date().toISOString(), competitionId },
    ]);
  }

  eventLabel(event: CompEvent): string {
    return eventLabel(event);
  }
}
