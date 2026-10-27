import {
  AutomationSettings,
  DECLINE_REASONS,
  GroupDefaults,
  GroupId,
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
}

export const PARENT_CHILD_IDS = ['p-lena', 'p-ben', 'p-mats'];
export const DEMO_TRAINER_ID = 't-anna';

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

const TRAINERS: readonly [string, string, GroupId[]][] = [
  ['t-anna', 'Anna Brandt', ['G1', 'G2', 'G3']],
  ['t-jonas', 'Jonas Weber', ['WK', 'G1']],
  ['t-mira', 'Mira Köhler', ['WK', 'G3', 'G2']],
  ['t-tobias', 'Tobias Lorenz', ['MA']],
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
    trainerIds: ['t-mira', 't-jonas'],
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
    trainerIds: ['t-jonas', 't-mira'],
  },
  {
    weekday: 6,
    time: '09:00',
    duration: 90,
    venueId: 'v-hunteholz',
    groupIds: ['WK', 'G1'],
    trainerIds: ['t-anna', 't-jonas'],
  },
];

/** Small deterministic random generator (linear congruential). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

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

const GROUP_IDS: GroupId[] = ['G1', 'G2', 'G3', 'WK', 'MA'];

function isInGroups(person: Person, groupIds: GroupId[]): boolean {
  return person.groupId !== null && groupIds.includes(person.groupId);
}

export function markKey(sessionId: string, personId: string): string {
  return `${sessionId}:${personId}`;
}

export function createSampleData(today: string): SampleData {
  const random = createRandom(2027);
  const people: Person[] = [
    ...TRAINERS.map(
      ([id, name, trainerGroupIds]): Person => ({
        id,
        name,
        role: 'trainer',
        groupId: null,
        trainerGroupIds,
      }),
    ),
    ...SWIMMERS.map(
      ([id, name, groupId]): Person => ({
        id,
        name,
        role: 'swimmer',
        groupId,
        trainerGroupIds: [],
      }),
    ),
  ];

  const sessions: TrainingSession[] = [];
  const start = addDays(today, -42);
  for (let offset = 0; offset <= 70; offset++) {
    const date = addDays(start, offset);
    for (const slot of SLOTS.filter((candidate) => candidate.weekday === weekdayIndex(date))) {
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
        maxTrainers: 2,
        deadlineDate: addDays(date, -1),
        deadlineTime: '14:00',
      });
    }
  }

  const responses: SessionResponse[] = [];
  const marks: Record<string, Presence> = {};
  const swimmers = people.filter((person) => person.role === 'swimmer');
  const pastSessions = sessions.filter((session) => session.date < today);

  const alwaysMissing = new Map<string, Set<string>>();
  const markProblem = (personId: string, groupId: GroupId, count: number): void => {
    const recent = pastSessions
      .filter((session) => session.groupIds.includes(groupId))
      .slice(-count)
      .map((session) => session.id);
    alwaysMissing.set(personId, new Set(recent));
  };
  markProblem('p-finn', 'G2', 3);
  markProblem('p-pia', 'G3', 2);

  for (const session of sessions) {
    const isPast = session.date < today;
    for (const trainerId of session.trainerIds) {
      if (isPast) {
        responses.push({
          sessionId: session.id,
          personId: trainerId,
          asRole: 'trainer',
          status: 'registered',
        });
        marks[markKey(session.id, trainerId)] = 'present';
      } else if (random() < 0.5) {
        responses.push({
          sessionId: session.id,
          personId: trainerId,
          asRole: 'trainer',
          status: 'registered',
        });
      }
    }
    const groupSwimmers = swimmers.filter((person) => isInGroups(person, session.groupIds));
    for (const swimmer of groupSwimmers) {
      const roll = random();
      if (isPast) {
        if (alwaysMissing.get(swimmer.id)?.has(session.id)) {
          marks[markKey(session.id, swimmer.id)] = 'missing';
        } else if (roll < 0.7) {
          responses.push({
            sessionId: session.id,
            personId: swimmer.id,
            asRole: 'swimmer',
            status: 'registered',
          });
          marks[markKey(session.id, swimmer.id)] = 'present';
        } else if (roll < 0.78) {
          responses.push({
            sessionId: session.id,
            personId: swimmer.id,
            asRole: 'swimmer',
            status: 'registered',
          });
          marks[markKey(session.id, swimmer.id)] = 'missing';
        } else if (roll < 0.92) {
          responses.push({
            sessionId: session.id,
            personId: swimmer.id,
            asRole: 'swimmer',
            status: 'declined',
            reason: DECLINE_REASONS[Math.floor(random() * 3)],
          });
        } else {
          marks[markKey(session.id, swimmer.id)] = 'missing';
        }
      } else if (roll < 0.5) {
        responses.push({
          sessionId: session.id,
          personId: swimmer.id,
          asRole: 'swimmer',
          status: 'registered',
        });
      } else if (roll < 0.6) {
        responses.push({
          sessionId: session.id,
          personId: swimmer.id,
          asRole: 'swimmer',
          status: 'declined',
          reason: DECLINE_REASONS[Math.floor(random() * 3)],
        });
      }
    }
  }

  const defaults = {} as Record<GroupId, GroupDefaults>;
  for (const groupId of GROUP_IDS) {
    const trainerIds: string[] = [];
    for (const [id, , groups] of TRAINERS) {
      if (groups.includes(groupId)) trainerIds.push(id);
    }
    defaults[groupId] = {
      venueId: groupId === 'MA' ? 'v-delfin' : 'v-roshop',
      durationMinutes: groupId === 'WK' ? 90 : 60,
      deadlineDaysBefore: 1,
      deadlineTime: '14:00',
      maxSwimmers: 15,
      maxTrainers: 2,
      trainerIds,
    };
  }

  return {
    people,
    venues: VENUES,
    sessions,
    responses,
    marks,
    defaults,
    automation: {
      infoMailAfter: 2,
      inactiveAfter: 3,
      infoMailTemplate: INFO_MAIL,
      inactiveMailTemplate: INACTIVE_MAIL,
    },
  };
}
