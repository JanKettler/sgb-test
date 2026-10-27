import { parseIsoDate } from '../training/training-dates';
import { Member } from './people.models';

export type EvidenceKind =
  | 'attest'
  | 'firstAid'
  | 'lifeSaving'
  | 'criminalRecord'
  | 'codeOfConduct'
  | 'license'
  | 'refereeLicense';

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  attest: 'Sportgesundheit',
  firstAid: 'Erste Hilfe',
  lifeSaving: 'Rettungsnachweis',
  criminalRecord: 'Führungszeugnis',
  codeOfConduct: 'Ehrenkodex',
  license: 'Trainerlizenz',
  refereeLicense: 'Kampfrichter-Lizenz',
};

export const EVIDENCE_KINDS = Object.keys(EVIDENCE_LABELS) as EvidenceKind[];

/** bad = missing or expired, warn = soon, info = within 90 days, ok = fine */
export type Tone = 'bad' | 'warn' | 'info' | 'ok';

export interface EvidenceRow {
  member: Member;
  kind: EvidenceKind;
  label: string;
  role: string;
  /** ISO date; empty when nothing is on file */
  date: string;
  /** Days until it expires; negative when expired, null without an expiry date. */
  days: number | null;
  missing: boolean;
  tone: Tone;
  /** Short text such as "läuft in 21 Tagen ab" */
  text: string;
}

export interface MemberStatus {
  tone: Tone;
  text: string;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

function row(
  member: Member,
  kind: EvidenceKind,
  role: string,
  date: string,
  today: string,
): EvidenceRow {
  const label = EVIDENCE_LABELS[kind];
  const base = { member, kind, label, role, date };
  if (!date) {
    const text = `${label} fehlt`;
    return { ...base, days: null, missing: true, tone: 'bad', text };
  }
  if (kind === 'criminalRecord' || kind === 'codeOfConduct') {
    return { ...base, days: null, missing: false, tone: 'ok', text: 'liegt vor' };
  }
  const days = daysBetween(today, date);
  if (days < 0) {
    const text = `${label} abgelaufen`;
    return { ...base, days, missing: false, tone: 'bad', text };
  }
  const tone: Tone = days <= 60 ? 'warn' : days <= 90 ? 'info' : 'ok';
  const text = tone === 'ok' ? 'gültig' : `${label} läuft in ${days} Tagen ab`;
  return { ...base, days, missing: false, tone, text };
}

/** All evidence a member needs because of the roles they have. */
export function evidenceOf(member: Member, today: string): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  if (member.swimmer) rows.push(row(member, 'attest', 'Schwimmer', member.attestUntil, today));
  if (member.trainer) {
    rows.push(row(member, 'firstAid', 'Trainer', member.firstAidUntil, today));
    rows.push(row(member, 'lifeSaving', 'Trainer', member.lifeSavingUntil, today));
    rows.push(row(member, 'license', 'Trainer', member.licenseUntil, today));
    rows.push(row(member, 'codeOfConduct', 'Trainer', member.codeOfConductOn, today));
  }
  if (member.referee) {
    rows.push(row(member, 'refereeLicense', 'Kampfrichter', member.refereeUntil, today));
  }
  const clearanceRole = member.trainer ? 'Trainer' : member.referee ? 'Kampfrichter' : 'Funktionär';
  if (member.trainer || member.referee || member.official) {
    rows.push(row(member, 'criminalRecord', clearanceRole, member.criminalRecordOn, today));
  }
  return rows;
}

const TONE_ORDER: Tone[] = ['bad', 'warn', 'info', 'ok'];

/** The most urgent evidence decides what the list shows for the member. */
export function statusOf(rows: EvidenceRow[]): MemberStatus {
  let worst: EvidenceRow | undefined;
  for (const item of rows) {
    if (!worst || TONE_ORDER.indexOf(item.tone) < TONE_ORDER.indexOf(worst.tone)) worst = item;
  }
  if (!worst || worst.tone === 'ok') return { tone: 'ok', text: 'Alles gültig' };
  return { tone: worst.tone, text: worst.text };
}
