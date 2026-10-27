export type GroupId = 'G1' | 'G2' | 'G3' | 'WK' | 'MA';

export interface TrainingGroup {
  id: GroupId;
  name: string;
}

export const GROUPS: readonly TrainingGroup[] = [
  { id: 'G1', name: 'Gruppe 1' },
  { id: 'G2', name: 'Gruppe 2' },
  { id: 'G3', name: 'Gruppe 3' },
  { id: 'WK', name: 'WK-Gruppe' },
  { id: 'MA', name: 'Masters' },
];

export type PersonRole = 'swimmer' | 'trainer';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  /** Training group of a swimmer; trainers have none. */
  groupId: GroupId | null;
  /** Groups a trainer is responsible for by default. */
  trainerGroupIds: GroupId[];
}

export interface Venue {
  id: string;
  name: string;
}

export interface TrainingSession {
  id: string;
  /** ISO date, yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  durationMinutes: number;
  venueId: string;
  groupIds: GroupId[];
  note: string;
  trainerIds: string[];
  /** Swimmers that take part in this session only, outside the selected groups. */
  extraSwimmerIds: string[];
  maxSwimmers: number;
  maxTrainers: number;
  deadlineDate: string;
  deadlineTime: string;
}

export type ResponseStatus = 'registered' | 'declined';
export type DeclineReason = 'Krank' | 'Termin' | 'Schule' | 'Sonstiges';

export const DECLINE_REASONS: readonly DeclineReason[] = ['Krank', 'Termin', 'Schule', 'Sonstiges'];

export interface SessionResponse {
  sessionId: string;
  personId: string;
  /** Role in which the person answered (a trainer may also swim). */
  asRole: PersonRole;
  status: ResponseStatus;
  reason?: DeclineReason;
  note?: string;
}

/** Stored by the trainer. Declined persons are derived as "excused". */
export type Presence = 'present' | 'missing';
/** What is displayed in lists and in the matrix. */
export type AttendanceState = 'present' | 'missing' | 'excused';

export interface GroupDefaults {
  venueId: string;
  durationMinutes: number;
  deadlineDaysBefore: number;
  deadlineTime: string;
  maxSwimmers: number;
  maxTrainers: number;
  trainerIds: string[];
}

export interface AutomationSettings {
  infoMailAfter: number;
  inactiveAfter: number;
  infoMailTemplate: string;
  inactiveMailTemplate: string;
}

export type DemoRole = 'parent' | 'trainer' | 'admin';

export const DEMO_ROLES: readonly { id: DemoRole; label: string }[] = [
  { id: 'parent', label: 'Eltern' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'admin', label: 'Verwaltung' },
];
