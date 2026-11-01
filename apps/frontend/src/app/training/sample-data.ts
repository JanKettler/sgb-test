import {
  AutomationSettings,
  DEFAULT_REASONS,
  GroupDefaults,
  GroupId,
  MailTemplate,
  Person,
  Presence,
  SessionResponse,
  TrainingSession,
  Venue,
} from './training.models';
import { addDays, weekdayIndex } from './training-dates';

/**
 * Invented demo data. The portal repository is public, so no real members appear here.
 * Everything is generated relative to "today" so that the preview always looks current.
 */
export interface SampleData {
  people: Person[];
  venues: Venue[];
  sessions: TrainingSession[];
  responses: SessionResponse[];
  marks: Record<string, Presence>;
  defaults: Record<GroupId, GroupDefaults>;
  automation: AutomationSettings;
  templates: MailTemplate[];
}

export const PARENT_CHILD_IDS = ['p-lena', 'p-ben', 'p-mats'];
/** The demo trainer swims in the WK group and trains other groups. */
export const DEMO_TRAINER_ID = 't-jonas';

const GROUP_IDS: GroupId[] = ['G1', 'G2', 'G3', 'WK', 'MA'];

const SWIMMERS: readonly [string, string, GroupId][] = [
  ['p-mats', 'Mats Hartmann', 'WK'],
  ['p-emil', 'Emil Sander', 'WK'],
  ['p-nele', 'Nele Fischer', 'WK'],
  ['p-paul', 'Paul Krüger', 'WK'],
  ['p-sophie', 'Sophie Neumann', 'WK'],
  ['p-felix', 'Felix Albrecht', 'WK'],
  ['p-greta', 'Greta Lindner', 'WK'],
  ['p-jannik', 'Jannik Roth', 'WK'],
  ['p-ben', 'Ben Hartmann', 'G1'],
  ['p-lotta', 'Lotta Meyer', 'G1'],
  ['p-oskar', 'Oskar Wolff', 'G1'],
  ['p-hanna', 'Hanna Beck', 'G1'],
  ['p-leon', 'Leon Schubert', 'G1'],
  ['p-mia', 'Mia Vogel', 'G1'],
  ['p-lena', 'Lena Hartmann', 'G2'],
  ['p-finn', 'Finn Ahrens', 'G2'],
  ['p-clara', 'Clara Dietz', 'G2'],
  ['p-noah', 'Noah Engel', 'G2'],
  ['p-emma', 'Emma Pohl', 'G2'],
  ['p-theo', 'Theo Franke', 'G2'],
  ['p-ida', 'Ida Kramer', 'G3'],
  ['p-jonte', 'Jonte Busch', 'G3'],
  ['p-amelie', 'Amelie Ritter', 'G3'],
  ['p-max', 'Max Lenz', 'G3'],
  ['p-pia', 'Pia Horn', 'G3'],
  ['p-ole', 'Ole Simon', 'G3'],
  ['p-katrin', 'Katrin Bauer', 'MA'],
  ['p-stefan', 'Stefan Moll', 'MA'],
  ['p-birgit', 'Birgit Arnold', 'MA'],
  ['p-holger', 'Holger Winter', 'MA'],
];

const TRAINERS: readonly [string, string, GroupId[], GroupId | null][] = [
  ['t-anna', 'Anna Brandt', ['G1', 'G2', 'G3'], null],
  ['t-jonas', 'Jonas Weber', ['G1', 'G2'], 'WK'],
  ['t-mira', 'Mira Köhler', ['WK', 'G3', 'G2'], null],
  ['t-tobias', 'Tobias Lorenz', ['MA'], null],
];

const VENUES: Venue[] = [
  { id: 'v-roshop', name: 'Hallenbad Roshop' },
  { id: 'v-hunteholz', name: 'Freizeitbad Hunteholz' },
  { id: 'v-delfin', name: 'Hallenbad Delfin' },
];

interface Slot {
  weekday: number;
  time: string;
  duration: number;
  venueId: string;
  groupIds: GroupId[];
  trainerIds: string[];
}

const SLOTS: readonly Slot[] = [
  {
    weekday: 2,
    time: '17:30',
    duration: 60,
    venueId: 'v-roshop',
    groupIds: ['G1', 'G2'],
    trainerIds: ['t-anna', 't-jonas'],
  },
  {
    weekday: 2,
    time: '18:30',
    duration: 90,
    venueId: 'v-roshop',
    groupIds: ['WK'],
    trainerIds: ['t-mira', 't-anna'],
  },
  {
    weekday: 3,
    time: '20:00',
    duration: 60,
    venueId: 'v-delfin',
    groupIds: ['MA'],
    trainerIds: ['t-tobias'],
  },
  {
    weekday: 4,
    time: '17:00',
    duration: 60,
    venueId: 'v-roshop',
    groupIds: ['G3', 'G2'],
    trainerIds: ['t-anna', 't-mira'],
  },
  {
    weekday: 4,
    time: '18:00',
    duration: 90,
    venueId: 'v-roshop',
    groupIds: ['WK'],
    trainerIds: ['t-mira', 't-anna'],
  },
  {
    weekday: 6,
    time: '09:00',
    duration: 90,
    venueId: 'v-hunteholz',
    groupIds: ['WK', 'G1'],
    trainerIds: ['t-anna', 't-mira'],
  },
];

const INFO_MAIL = [
  'Hallo {Name},',
  '',
  'uns ist aufgefallen, dass du zuletzt nicht beim Training warst.',
  'Gib uns bitte kurz Bescheid, ob alles in Ordnung ist.',
  '',
  'Sportliche Grüße',
  'Dein Trainerteam',
].join('\n');

const INACTIVE_MAIL = [
  'Hallo {Name},',
  '',
  'da wir länger nichts von dir gehört haben, setzen wir dich vorerst auf inaktiv.',
  'Melde dich gern, wenn du wieder mitschwimmen möchtest.',
  '',
  'Sportliche Grüße',
  'Dein Trainerteam',
].join('\n');

/** Small deterministic random generator (linear congruential). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function markKey(sessionId: string, personId: string): string {
  return `${sessionId}:${personId}`;
}

function buildPeople(): Person[] {
  const people: Person[] = [];
  for (const [id, name, trainerGroupIds, groupId] of TRAINERS) {
    people.push({ id, name, groupId, trainerGroupIds });
  }
  for (const [id, name, groupId] of SWIMMERS) {
    people.push({ id, name, groupId, trainerGroupIds: [] });
  }
  return people;
}

function buildSessions(today: string): TrainingSession[] {
  const sessions: TrainingSession[] = [];
  const start = addDays(today, -42);
  for (let offset = 0; offset <= 70; offset++) {
    const date = addDays(start, offset);
    for (const slot of SLOTS) {
      if (slot.weekday !== weekdayIndex(date)) continue;
      sessions.push({
        id: `s${sessions.length + 1}`,
        date,
        time: slot.time,
        durationMinutes: slot.duration,
        venueId: slot.venueId,
        groupIds: slot.groupIds,
        note: '',
        trainerIds: slot.trainerIds,
        extraSwimmerIds: [],
        maxSwimmers: 15,
        deadlineDate: addDays(date, -1),
        deadlineTime: '14:00',
      });
    }
  }
  return sessions;
}

function buildDefaults(): Record<GroupId, GroupDefaults> {
  const defaults = {} as Record<GroupId, GroupDefaults>;
  for (const groupId of GROUP_IDS) {
    const trainerIds: string[] = [];
    for (const trainer of TRAINERS) {
      if (trainer[2].includes(groupId)) trainerIds.push(trainer[0]);
    }
    defaults[groupId] = {
      venueId: groupId === 'MA' ? 'v-delfin' : 'v-roshop',
      durationMinutes: groupId === 'WK' ? 90 : 60,
      deadlineDaysBefore: 1,
      deadlineTime: '14:00',
      maxSwimmers: 15,
      trainerIds,
    };
  }
  return defaults;
}

export function createSampleData(today: string): SampleData {
  const random = createRandom(2027);
  const people = buildPeople();
  const sessions = buildSessions(today);
  const responses: SessionResponse[] = [];
  const marks: Record<string, Presence> = {};

  // Two swimmers who missed the latest sessions in a row, to show the action list.
  const problems = new Map<string, Set<string>>();
  const pastSessions = sessions.filter((session) => session.date < today);
  for (const [personId, groupId, count] of [
    ['p-finn', 'G2', 3],
    ['p-pia', 'G3', 2],
  ] as const) {
    const recent = pastSessions.filter((session) => session.groupIds.includes(groupId));
    problems.set(personId, new Set(recent.slice(-count).map((session) => session.id)));
  }

  const answer = (
    sessionId: string,
    personId: string,
    asRole: SessionResponse['asRole'],
    status: SessionResponse['status'],
  ): void => {
    const response: SessionResponse = { sessionId, personId, asRole, status };
    if (status === 'declined') response.reason = DEFAULT_REASONS[Math.floor(random() * 3)];
    responses.push(response);
  };

  for (const session of sessions) {
    const isPast = session.date < today;
    for (const trainerId of session.trainerIds) {
      if (isPast || random() < 0.5) answer(session.id, trainerId, 'trainer', 'registered');
    }
    const trainers = new Set(session.trainerIds);
    for (const swimmer of people) {
      const belongs = swimmer.groupId !== null && session.groupIds.includes(swimmer.groupId);
      if (!belongs || trainers.has(swimmer.id)) continue;
      const roll = random();
      const key = markKey(session.id, swimmer.id);
      if (!isPast) {
        if (roll < 0.5) answer(session.id, swimmer.id, 'swimmer', 'registered');
        else if (roll < 0.6) answer(session.id, swimmer.id, 'swimmer', 'declined');
      } else if (problems.get(swimmer.id)?.has(session.id)) {
        marks[key] = 'missing';
      } else if (roll < 0.7) {
        answer(session.id, swimmer.id, 'swimmer', 'registered');
      } else if (roll < 0.78) {
        answer(session.id, swimmer.id, 'swimmer', 'registered');
        marks[key] = 'missing';
      } else if (roll < 0.92) {
        answer(session.id, swimmer.id, 'swimmer', 'declined');
      } else {
        marks[key] = 'missing';
      }
    }
  }

  return {
    people,
    venues: VENUES,
    sessions,
    responses,
    marks,
    defaults: buildDefaults(),
    automation: { infoMailAfter: 2, inactiveAfter: 3 },
    templates: [
      {
        id: 'info',
        name: 'Info nach 2 Fehlzeiten',
        subject: 'Wir vermissen dich',
        text: INFO_MAIL,
      },
      {
        id: 'inactive',
        name: 'Auf inaktiv gesetzt',
        subject: 'Status inaktiv',
        text: INACTIVE_MAIL,
      },
    ],
  };
}
