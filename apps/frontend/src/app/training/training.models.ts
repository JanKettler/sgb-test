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

/** A member. Somebody can swim in a group and train other groups at the same time. */
export interface Person {
  id: string;
  name: string;
  /** Training group as a swimmer; null for people who only train. */
  groupId: GroupId | null;
  /** Groups the person trains by default; empty for pure swimmers. */
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
  deadlineDate: string;
  deadlineTime: string;
}

export type ResponseStatus = 'registered' | 'declined';
/** "Sonstiges" additionally takes an optional remark. */
export type DeclineReason = string;
export const OTHER_REASON = 'Sonstiges';

export const DEFAULT_REASONS: readonly DeclineReason[] = [
  'Krank',
  'Termin',
  'Schule',
  OTHER_REASON,
];

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
  trainerIds: string[];
}

export interface AutomationSettings {
  infoMailAfter: number;
  inactiveAfter: number;
}

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  text: string;
}

export type DemoRole = 'parent' | 'trainer' | 'admin';

export const DEMO_ROLES: readonly { id: DemoRole; label: string }[] = [
  { id: 'parent', label: 'Eltern' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'admin', label: 'Verwaltung' },
];
