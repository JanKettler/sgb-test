import { Injectable, computed, inject, signal } from '@angular/core';
import { StartStore } from '../start/start.store';
import { addDays } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import {
  Drive,
  DriveState,
  EMPTY_PROFILE,
  Profile,
  Rates,
  Statement,
  StatementLine,
  StatementState,
  inPeriod,
  parseTitle,
  periodTitle,
  rateFor,
  sameOwner,
  sortLines,
  sumsOf,
} from './billing.models';

/** What a drive needs when it is entered. */
export interface DriveData {
  owner: string;
  date: string;
  note: string;
}

/** A day of the competition training on which nobody has entered a drive yet. */
export interface DriveCandidate {
  date: string;
  note: string;
}

const COMPETITION_GROUP = 'WK';

function newestFirst(list: readonly Statement[]): Statement[] {
  return [...list].sort((a, b) => b.changed - a.changed);
}

function unique(names: readonly string[]): string[] {
  return [...new Set(names.filter((name) => name !== ''))].sort((a, b) => a.localeCompare(b, 'de'));
}

function key(owner: string): string {
  return owner.trim().toLocaleLowerCase('de');
}

/** In-memory stand-in for the future billing API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class BillingStore {
  private readonly training = inject(TrainingStore);
  private readonly start = inject(StartStore);
  private counter = 100;
  private clock = 100;
  readonly today = this.training.today;

  readonly isAdmin = this.training.isAdmin;
  /** Trainers and the board bill their hours and drives. */
  readonly canBill = this.training.canManage;
  /** The name that the statements and drives of the logged-in person carry. */
  readonly me = computed(
    () =>
      this.training.trainers().find((trainer) => sameOwner(trainer.name, this.start.userName()))
        ?.name ?? this.start.userName(),
  );

  readonly rates = signal<Rates>(this.sampleRates());
  readonly profiles = signal<Record<string, Profile>>(this.sampleProfiles());
  readonly statements = signal<Statement[]>(this.sampleStatements());
  readonly drives = signal<Drive[]>(this.sampleDrives());

  readonly mine = computed(() =>
    newestFirst(this.statements().filter((statement) => sameOwner(statement.owner, this.me()))),
  );
  readonly everyone = computed(() => newestFirst(this.statements()));
  readonly draftCount = computed(
    () => this.mine().filter((statement) => statement.state === 'draft').length,
  );
  readonly submittedCount = computed(
    () => this.statements().filter((statement) => statement.state === 'submitted').length,
  );

  readonly myDrives = computed(() =>
    this.drives()
      .filter((drive) => sameOwner(drive.owner, this.me()))
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly openDriveCount = computed(
    () => this.myDrives().filter((drive) => drive.state === 'open').length,
  );
  readonly allOpenDriveCount = computed(
    () => this.drives().filter((drive) => drive.state === 'open').length,
  );

  /** Groups and places that are offered while typing a line: the known ones and the used ones. */
  readonly groupSuggestions = computed(() =>
    unique([
      ...this.training.groups.map((group) => group.name),
      ...this.statements().flatMap((statement) => statement.lines.map((line) => line.group)),
    ]),
  );
  readonly placeSuggestions = computed(() =>
    unique([
      ...this.training.venues().map((venue) => venue.name),
      ...this.statements().flatMap((statement) => statement.lines.map((line) => line.place)),
    ]),
  );

  /** Who can be entered as a driver: the list of the rates, or every trainer when it is empty. */
  readonly driverNames = computed(() => {
    const listed = this.rates().drivers;
    return listed.length > 0 ? listed : this.training.trainers().map((trainer) => trainer.name);
  });

  // --- Statements -------------------------------------------------------------------------------

  statement(id: string): Statement | undefined {
    return this.statements().find((statement) => statement.id === id);
  }

  /** Only the owner changes a draft; a statement that was sent or paid is locked. */
  canEdit(statement: Statement): boolean {
    return statement.state === 'draft' && sameOwner(statement.owner, this.me());
  }

  profileOf(owner: string): Profile {
    return this.profiles()[key(owner)] ?? EMPTY_PROFILE;
  }

  saveProfile(owner: string, profile: Profile): void {
    this.profiles.update((all) => ({ ...all, [key(owner)]: profile }));
  }

  /** A new draft for the logged-in person, filled in from the profile and the rates. */
  create(): Statement {
    const owner = this.me();
    const profile = this.profileOf(owner);
    const rates = this.rates();
    const statement: Statement = {
      id: `s-${++this.counter}`,
      owner,
      title: periodTitle(this.today),
      state: 'draft',
      name: owner,
      edv: profile.edv,
      license: profile.license,
      rate: rateFor(rates, profile.license),
      km: 0,
      kmRate: rates.km,
      carText: '',
      extra: 0,
      extraText: '',
      accountHolder: profile.accountHolder,
      iban: profile.iban,
      bic: profile.bic,
      lines: [],
      paidOn: '',
      paidBy: '',
      changed: ++this.clock,
    };
    this.statements.update((list) => [...list, statement]);
    return statement;
  }

  /** Changes a draft; sent and paid statements stay as they are. */
  update(id: string, change: Partial<Omit<Statement, 'id' | 'owner' | 'state' | 'lines'>>): void {
    if (this.statement(id)?.state === 'draft') this.patch(id, change);
  }

  /** Moves a statement on; returns what keeps it from moving, or an empty text. */
  setState(id: string, state: StatementState): string {
    const statement = this.statement(id);
    if (!statement) return '';
    if (state === 'submitted' && statement.state === 'draft' && !(sumsOf(statement).total > 0)) {
      return 'Die Abrechnung hat noch keinen Betrag.';
    }
    const paid = state === 'paid';
    this.patch(id, { state, paidOn: paid ? this.today : '', paidBy: paid ? this.me() : '' });
    return '';
  }

  remove(id: string): void {
    if (this.statement(id)?.state === 'draft') {
      this.statements.update((list) => list.filter((statement) => statement.id !== id));
    }
  }

  /** Adds a line or, when it has an id, changes it; returns what is wrong, or an empty text. */
  saveLine(statementId: string, line: StatementLine): string {
    if (!line.date) return 'Bitte ein Datum eintragen.';
    if (!(line.minutes > 0)) return 'Die Minuten müssen größer als 0 sein.';
    const statement = this.statement(statementId);
    if (statement?.state !== 'draft') return 'Diese Abrechnung ist gesperrt.';
    const lines = line.id
      ? statement.lines.map((item) => (item.id === line.id ? line : item))
      : [...statement.lines, { ...line, id: `ln-${++this.counter}` }];
    this.patch(statementId, { lines: sortLines(lines) });
    return '';
  }

  removeLine(statementId: string, lineId: string): void {
    const statement = this.statement(statementId);
    if (statement?.state !== 'draft') return;
    this.patch(statementId, { lines: statement.lines.filter((line) => line.id !== lineId) });
  }

  /**
   * The training units the owner held up to today in the period of the statement that are on no
   * statement yet. Statements of people who do not train have none.
   */
  candidateLines(statement: Statement): StatementLine[] {
    const trainer = this.training
      .trainers()
      .find((person) => sameOwner(person.name, statement.owner));
    if (!trainer) return [];
    const period = parseTitle(statement.title);
    const billed = this.billedKeys(statement.owner);
    const lines = this.training
      .sessions()
      .filter(
        (session) =>
          session.trainerIds.includes(trainer.id) &&
          session.date <= this.today &&
          (!period || inPeriod(session.date, period.year, period.period)) &&
          !billed.has(`${session.date}|${session.time}`),
      )
      .map<StatementLine>((session) => ({
        id: '',
        date: session.date,
        time: session.time,
        minutes: session.durationMinutes,
        group: this.training.groupNames(session),
        place: this.training.venueName(session.venueId),
      }));
    return sortLines(lines);
  }

  /** Takes over the lines, e.g. from the training units; returns how many were added. */
  addLines(statementId: string, lines: readonly StatementLine[]): number {
    const statement = this.statement(statementId);
    if (statement?.state !== 'draft' || lines.length === 0) return 0;
    const added = lines.map((line) => ({ ...line, id: `ln-${++this.counter}` }));
    this.patch(statementId, { lines: sortLines([...statement.lines, ...added]) });
    return added.length;
  }

  // --- Drives -----------------------------------------------------------------------------------

  canEditDrive(drive: Drive): boolean {
    return drive.state === 'open' && (this.isAdmin() || sameOwner(drive.owner, this.me()));
  }

  /** Enters a drive with the flat fee; returns what is wrong, or an empty text. */
  addDrive(data: DriveData): string {
    const problem = this.driveProblem(data, '');
    if (problem) return problem;
    const drive: Drive = {
      id: `f-${++this.counter}`,
      owner: data.owner.trim(),
      date: data.date,
      note: data.note.trim(),
      amount: this.rates().driveFee,
      state: 'open',
      settledOn: '',
    };
    this.drives.update((list) => [...list, drive]);
    return '';
  }

  updateDrive(id: string, data: Pick<DriveData, 'date' | 'note'>): string {
    const drive = this.drives().find((item) => item.id === id);
    if (!drive || drive.state !== 'open') return 'Diese Fahrt ist schon eingereicht.';
    const problem = this.driveProblem({ ...data, owner: drive.owner }, id);
    if (problem) return problem;
    this.drives.update((list) =>
      list.map((item) =>
        item.id === id ? { ...item, date: data.date, note: data.note.trim() } : item,
      ),
    );
    return '';
  }

  removeDrive(id: string): void {
    const drive = this.drives().find((item) => item.id === id);
    if (drive?.state === 'open')
      this.drives.update((list) => list.filter((item) => item.id !== id));
  }

  /** Marks drives as sent to the treasurer or as settled. */
  setDriveState(ids: readonly string[], state: DriveState): void {
    this.drives.update((list) =>
      list.map((drive) =>
        ids.includes(drive.id)
          ? { ...drive, state, settledOn: state === 'open' ? '' : this.today }
          : drive,
      ),
    );
  }

  /** The days of the competition training up to today in the period without a drive of the owner. */
  candidateDrives(owner: string, year: number, period: number): DriveCandidate[] {
    const taken = new Set(
      this.drives()
        .filter((drive) => sameOwner(drive.owner, owner))
        .map((drive) => drive.date),
    );
    const found = new Map<string, DriveCandidate>();
    for (const session of this.training.sessions()) {
      if (
        session.groupIds.includes(COMPETITION_GROUP) &&
        session.date <= this.today &&
        inPeriod(session.date, year, period) &&
        !taken.has(session.date) &&
        !found.has(session.date)
      ) {
        found.set(session.date, {
          date: session.date,
          note: `Wettkampftraining, ${this.training.venueName(session.venueId)}`,
        });
      }
    }
    return [...found.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  saveRates(rates: Rates): void {
    this.rates.set(rates);
  }

  // --- Internals --------------------------------------------------------------------------------

  private billedKeys(owner: string): Set<string> {
    return new Set(
      this.statements()
        .filter((statement) => sameOwner(statement.owner, owner))
        .flatMap((statement) => statement.lines.map((line) => `${line.date}|${line.time}`)),
    );
  }

  private driveProblem(data: DriveData, ownId: string): string {
    if (!data.owner.trim()) return 'Bitte die Fahrerin oder den Fahrer wählen.';
    if (!data.date) return 'Bitte ein Datum eintragen.';
    const twice = this.drives().some(
      (drive) =>
        drive.id !== ownId && sameOwner(drive.owner, data.owner) && drive.date === data.date,
    );
    return twice ? 'Für diesen Tag gibt es schon eine Fahrt.' : '';
  }

  private patch(id: string, change: Partial<Statement>): void {
    const changed = ++this.clock;
    this.statements.update((list) =>
      list.map((statement) =>
        statement.id === id ? { ...statement, ...change, changed } : statement,
      ),
    );
  }

  private sampleRates(): Rates {
    return {
      hourly: 12,
      km: 0.3,
      driveFee: 6,
      drivers: ['Anna Brandt', 'Jonas Weber', 'Mira Köhler', 'Tobias Lorenz'],
      licenses: [
        { name: 'Trainer B', rate: 15 },
        { name: 'Trainer C', rate: 13 },
        { name: 'Assistent', rate: 8 },
      ],
    };
  }

  private sampleProfiles(): Record<string, Profile> {
    return {
      [key('Jonas Weber')]: {
        edv: '4711-12',
        license: 'Trainer C',
        accountHolder: 'Jonas Weber',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'COBADEFFXXX',
      },
      [key('Maria')]: { ...EMPTY_PROFILE, license: 'Trainer B' },
    };
  }

  private sampleStatements(): Statement[] {
    const day = (offset: number) => addDays(this.today, offset);
    const line = (
      id: string,
      offset: number,
      time: string,
      minutes: number,
      group: string,
      place: string,
    ): StatementLine => ({ id, date: day(offset), time, minutes, group, place });
    const base = {
      extra: 0,
      extraText: '',
      km: 0,
      carText: '',
      paidOn: '',
      paidBy: '',
      kmRate: 0.3,
    };
    return [
      {
        ...base,
        id: 's-1',
        owner: 'Jonas Weber',
        title: periodTitle(day(-100)),
        state: 'paid',
        name: 'Jonas Weber',
        edv: '4711-12',
        license: 'Trainer C',
        rate: 13,
        accountHolder: 'Jonas Weber',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'COBADEFFXXX',
        lines: [-110, -103, -96, -89, -82].map((offset, index) =>
          line(`ln-1${index}`, offset, '17:30', 60, 'Gruppe 1, Gruppe 2', 'Hallenbad Roshop'),
        ),
        paidOn: day(-60),
        paidBy: 'Maria',
        changed: 10,
      },
      {
        ...base,
        id: 's-3',
        owner: 'Anna Brandt',
        title: periodTitle(day(-110)),
        state: 'submitted',
        name: 'Anna Brandt',
        edv: '2087-03',
        license: 'Trainer B',
        rate: 15,
        km: 36,
        carText: 'Trainerfortbildung',
        accountHolder: 'Anna Brandt',
        iban: 'DE02 1203 0000 0000 2020 51',
        bic: 'BYLADEM1001',
        lines: [-112, -105, -98, -91].map((offset, index) =>
          line(`ln-3${index}`, offset, '18:00', 90, 'WK-Gruppe', 'Hallenbad Roshop'),
        ),
        changed: 20,
      },
      {
        ...base,
        id: 's-2',
        owner: 'Jonas Weber',
        title: periodTitle(this.today),
        state: 'draft',
        name: 'Jonas Weber',
        edv: '4711-12',
        license: 'Trainer C',
        rate: 13,
        km: 24,
        carText: 'Kampfrichter-Lehrgang',
        accountHolder: 'Jonas Weber',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'COBADEFFXXX',
        lines: [-14, -7].map((offset, index) =>
          line(`ln-2${index}`, offset, '17:30', 60, 'Gruppe 1, Gruppe 2', 'Hallenbad Roshop'),
        ),
        changed: 30,
      },
      {
        ...base,
        id: 's-4',
        owner: 'Maria',
        title: periodTitle(this.today),
        state: 'draft',
        name: 'Maria',
        edv: '',
        license: 'Trainer B',
        rate: 15,
        accountHolder: '',
        iban: '',
        bic: '',
        lines: [-9, -2].map((offset, index) =>
          line(`ln-4${index}`, offset, '10:00', 90, 'Schwimmschule', 'Hallenbad Roshop'),
        ),
        changed: 40,
      },
    ];
  }

  private sampleDrives(): Drive[] {
    const day = (offset: number) => addDays(this.today, offset);
    const drive = (
      id: string,
      owner: string,
      offset: number,
      state: DriveState,
      place: string,
    ): Drive => ({
      id,
      owner,
      date: day(offset),
      note: `Wettkampftraining, ${place}`,
      amount: 6,
      state,
      settledOn: state === 'open' ? '' : day(offset + 10),
    });
    return [
      drive('f-1', 'Jonas Weber', -20, 'open', 'Hallenbad Roshop'),
      drive('f-2', 'Jonas Weber', -13, 'open', 'Freizeitbad Hunteholz'),
      drive('f-3', 'Jonas Weber', -60, 'settled', 'Hallenbad Roshop'),
      drive('f-4', 'Anna Brandt', -9, 'open', 'Hallenbad Roshop'),
      drive('f-5', 'Anna Brandt', -16, 'open', 'Hallenbad Roshop'),
      drive('f-6', 'Mira Köhler', -27, 'submitted', 'Hallenbad Roshop'),
      drive('f-7', 'Maria', -6, 'open', 'Hallenbad Roshop'),
    ];
  }
}
