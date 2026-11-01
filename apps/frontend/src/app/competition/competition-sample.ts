import { Member, birthYear } from '../people/people.models';
import { addDays } from '../training/training-dates';
import { GroupId } from '../training/training.models';
import {
  CompEvent,
  Competition,
  Entry,
  PHASES,
  RelayEntry,
  RunResult,
  RunStart,
  emptyPlan,
  emptySchedule,
  msToTime,
  startKey,
} from './competition.models';
import { sampleBase } from './evaluation/wa-sample';

export function sampleEvents(): CompEvent[] {
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

/** An invented meet on a given day. */
export function sampleMeetOn(
  id: string,
  title: string,
  place: string,
  venue: string,
  date: string,
  groupIds: GroupId[],
  open: boolean,
): Competition {
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

/** An invented meet a number of days from today. */
export function sampleMeet(
  id: string,
  title: string,
  place: string,
  venue: string,
  inDays: number,
  groupIds: GroupId[],
  open: boolean,
  today: string,
): Competition {
  return sampleMeetOn(id, title, place, venue, addDays(today, inDays), groupIds, open);
}

// ---- A finished season with invented results -----------------------------------------------

/** What the demo season adds to the competition store. */
export interface PastSeason {
  competitions: Competition[];
  entries: Entry[];
  relays: RelayEntry[];
}

const PAST_MEETS: readonly {
  id: string;
  title: string;
  place: string;
  venue: string;
  monthDay: string;
  pool: number;
}[] = [
  {
    id: 'c-s1',
    title: 'Frühjahrsschwimmfest',
    place: 'Beispielstadt',
    venue: 'Hallenbad Beispielstadt',
    monthDay: '03-14',
    pool: 25,
  },
  {
    id: 'c-s2',
    title: 'Sommerpokal',
    place: 'Musterhausen',
    venue: 'Freibad Musterhausen',
    monthDay: '05-16',
    pool: 50,
  },
  {
    id: 'c-s3',
    title: 'Sprint-Cup',
    place: 'Beispielstadt',
    venue: 'Hallenbad Beispielstadt',
    monthDay: '06-27',
    pool: 25,
  },
];

const STROKE_WORD: Record<string, string> = {
  F: 'FREE',
  R: 'BACK',
  B: 'BREAST',
  S: 'FLY',
  L: 'MEDLEY',
};

/** Event numbers of the sample meets per sex: men have the odd, women the even ones. */
const EVENTS_OF: Record<'M' | 'W', number[]> = { M: [1, 3, 5, 7, 9], W: [2, 4, 6, 8, 10] };
const RELAY_EVENT = 11;
/** Lanes in the order a heat is seeded: the middle lanes first. */
const LANES = [3, 4, 2, 5];
/** How much slower than the base time swimmers of age 8, 9, 10 ... 17 are. */
const YOUTH_FACTOR = [2.25, 2.05, 1.85, 1.7, 1.58, 1.48, 1.4, 1.33, 1.28, 1.24];
const DUTIES = ['Zeitnehmer', 'Wendenrichter', 'Zielrichter'];

/** A fixed number for a text, so the same demo data comes out every time. */
function hash(text: string): number {
  let value = 7;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function ageFactor(age: number): number {
  if (age < 8) return 2.3;
  if (age <= 17) return YOUTH_FACTOR[age - 8];
  if (age <= 24) return 1.2 + (age - 18) * 0.01;
  return Math.min(1.7, 1.3 + (age - 25) * 0.012);
}

/** Time of a swimmer over one distance in hundredths: base time, age, form of the day. */
function hundredthsOf(
  swimmer: Swimmer,
  pool: number,
  distance: number,
  stroke: string,
  season: number,
  meetIndex: number,
  slower: number,
): number | null {
  const base = sampleBase(pool, swimmer.sex, distance, stroke);
  if (base === null) return null;
  const single = 0.94 + (hash(swimmer.name) % 2000) / 10000;
  const better = 1 - 0.012 * meetIndex;
  return Math.round(base * ageFactor(season - swimmer.year) * single * better * (1 + slower));
}

interface Swimmer {
  member: Member;
  /** "Lastname, Firstname" as printed in a Meldeergebnis. */
  name: string;
  year: number;
  sex: 'M' | 'W';
}

interface PlannedStart {
  swimmer: Swimmer;
  eventNo: number;
  /** Time in hundredths of a second. */
  hundredths: number;
  /** Time of the same event at the meet before, as entry time. */
  entry: string;
}

/** The year of the demo season: the current one once July is over, else the last one. */
export function seasonOf(today: string): number {
  const year = Number(today.slice(0, 4));
  return today >= `${year}-07-01` ? year : year - 1;
}

/**
 * Three finished meets of the season with invented starts and results for the club's competing
 * demo swimmers. The meets are closed: nobody registers for them any more.
 */
export function pastSeason(today: string, members: readonly Member[]): PastSeason {
  const season = seasonOf(today);
  const swimmers: Swimmer[] = members
    .filter((member) => member.swimmer && member.competes)
    .map(
      (member): Swimmer => ({
        member,
        name: `${member.lastName}, ${member.firstName}`,
        year: birthYear(member),
        sex: member.sex === 'M' ? 'M' : 'W',
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const referees = members.filter((member) => member.referee);
  const library = sampleEvents();
  const competitions: Competition[] = [];
  const entries: Entry[] = [];
  const relays: RelayEntry[] = [];
  const last = new Map<string, string>();

  PAST_MEETS.forEach((spec, meetIndex) => {
    const date = `${season}-${spec.monthDay}`;
    const meet: Competition = {
      ...sampleMeetOn(spec.id, spec.title, spec.place, spec.venue, date, [], false),
      pool: spec.pool,
      sent: true,
    };
    const planned: PlannedStart[] = [];
    for (const swimmer of swimmers) {
      if (hash(swimmer.name + spec.id) % 7 === 0) continue;
      const pool = EVENTS_OF[swimmer.sex];
      const count = 2 + (hash(swimmer.name + spec.id + 'n') % 2);
      const first = hash(swimmer.name) % pool.length;
      for (let k = 0; k < count; k++) {
        const eventNo = pool[(first + k) % pool.length];
        const event = library.find((item) => item.no === eventNo);
        if (!event) continue;
        const hundredths = hundredthsOf(
          swimmer,
          spec.pool,
          event.distance,
          STROKE_WORD[event.stroke],
          season,
          meetIndex,
          (k % 2) * 0.03,
        );
        if (hundredths === null) continue;
        planned.push({
          swimmer,
          eventNo,
          hundredths,
          entry: last.get(`${swimmer.member.id}-${eventNo}`) ?? '',
        });
      }
    }

    // One disqualification at the second meet and one no-show at the third.
    const dq = meetIndex === 1 ? planned.find((item) => item.swimmer === swimmers[0]) : undefined;
    const noShow =
      meetIndex === 2
        ? [...planned].reverse().find((item) => item.swimmer === swimmers[swimmers.length - 1])
        : undefined;
    const starts: RunStart[] = [];
    const results: Record<string, RunResult> = {};
    const clock = (eventNo: number, heat: number) => {
      const minutes = 10 * 60 + (eventNo - 1) * 12 + (heat - 1) * 2;
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    };
    for (const event of library) {
      const ofEvent = planned
        .filter((item) => item.eventNo === event.no)
        .sort(
          (a, b) => b.hundredths - a.hundredths || a.swimmer.name.localeCompare(b.swimmer.name),
        );
      const heats = Math.ceil(ofEvent.length / LANES.length);
      const order = [...ofEvent].sort((a, b) => a.hundredths - b.hundredths);
      const shift = hash(spec.id + event.no) % 3;
      ofEvent.forEach((item, index) => {
        const heat = Math.floor(index / LANES.length) + 1;
        const start: RunStart = {
          e: event.no,
          l: heat,
          lt: heats,
          t: clock(event.no, heat),
          b: LANES[index % LANES.length],
          n: item.swimmer.name,
          s: item.swimmer.sex,
          j: String(item.swimmer.year),
          m: item.entry,
        };
        starts.push(start);
        entries.push({
          competitionId: spec.id,
          personId: item.swimmer.member.id,
          eventNo: event.no,
          time: item.entry,
        });
        const time = msToTime(item.hundredths * 10);
        const lost = item === dq || item === noShow;
        const status = item === dq ? 'DQ' : item === noShow ? 'nicht angetreten' : '';
        results[startKey(start)] = {
          t: lost ? '' : time,
          sp: [],
          status,
          place: lost ? 0 : order.indexOf(item) + 1 + shift,
          ageGroup: '',
        };
        if (!lost) last.set(`${item.swimmer.member.id}-${event.no}`, time);
      });
    }

    // One relay team of four swimmers who are at the meet anyway.
    const team = [...new Set(planned.map((item) => item.swimmer))]
      .sort((a, b) => hash(a.name + spec.id) - hash(b.name + spec.id))
      .slice(0, 4);
    const relayEvent = library.find((item) => item.no === RELAY_EVENT);
    if (relayEvent && team.length === 4) {
      const total = team.reduce(
        (sum, swimmer) =>
          sum + (hundredthsOf(swimmer, spec.pool, 50, 'FREE', season, meetIndex, 0) ?? 0),
        0,
      );
      const relayStart: RunStart = {
        e: RELAY_EVENT,
        l: 1,
        lt: 1,
        t: clock(RELAY_EVENT, 1),
        b: 4,
        n: '1. Mannschaft',
        s: '',
        j: 'Staffel',
        m: '',
      };
      starts.push(relayStart);
      results[startKey(relayStart)] = {
        t: msToTime(total * 10),
        sp: [],
        status: '',
        place: 2,
        ageGroup: '',
      };
      relays.push({
        competitionId: spec.id,
        eventNo: RELAY_EVENT,
        team: 1,
        year: Math.round(team.reduce((sum, swimmer) => sum + swimmer.year, 0) / 4),
        time: '',
        memberIds: team.map((swimmer) => swimmer.member.id),
      });
      meet.schedule.relayResults = [
        { e: RELAY_EVENT, place: 2, time: msToTime(total * 10), status: '' },
      ];
    }

    // The judges of the club per section, as the protocol lists them.
    const panel: [number, number][] = [
      [1, meetIndex],
      [1, meetIndex + 1],
      [2, meetIndex + 2],
    ];
    if (referees.length > 0) {
      meet.schedule.duties = panel.map(([section, at], index) => ({
        a: section,
        g: 'laut Protokoll',
        pos: DUTIES[index % DUTIES.length],
        name: `${referees[at % referees.length].firstName} ${referees[at % referees.length].lastName}`,
      }));
      for (const [section, at] of panel) {
        const id = referees[at % referees.length].id;
        const before = meet.officials[section] ?? [];
        if (!before.includes(id)) meet.officials[section] = [...before, id];
      }
    }

    meet.schedule.starts = starts;
    meet.schedule.results = results;
    meet.schedule.stand = date;
    meet.plan = {
      ...emptyPlan(),
      done: Object.fromEntries(
        PHASES.flatMap((phase) =>
          phase.items.map((item): [string, { by: string; at: string }] => [
            item[0],
            { by: 'Demo', at: date },
          ]),
        ),
      ),
      fee: 'paid',
      participation: 'yes',
    };
    competitions.push(meet);
  });
  return { competitions, entries, relays };
}
