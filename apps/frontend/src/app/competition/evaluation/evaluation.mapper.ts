import { GROUPS } from '../../training/training.models';
import { Member, birthYear } from '../../people/people.models';
import { Competition, dateOf, displayName, eventTitle } from '../competition.models';
import { EvalMeet, EvalMember, EvalResult, EvalStart } from './evaluation.model';

/** "Muster, Anna" and "Anna Muster" give the same token, so names can be matched. */
export function nameToken(name: string): string {
  return name.toLowerCase().replaceAll(',', ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}

/** Sex by name token for the people of the club, used where a start has none of its own. */
export function sexByName(members: readonly Member[]): Map<string, string> {
  return new Map(
    members.map((member) => [nameToken(`${member.firstName} ${member.lastName}`), member.sex]),
  );
}

/**
 * Turns a meet of the competition store into what the evaluation reads. The sex of a start comes
 * from the Meldeergebnis, else from the event, else from the member list.
 */
export function toEvalMeet(
  meet: Competition,
  fee: number | null,
  sexes: ReadonlyMap<string, string>,
): EvalMeet {
  const numbers = new Set<number>([
    ...meet.events.map((event) => event.no),
    ...Object.keys(meet.schedule.eventNames).map(Number),
    ...meet.schedule.starts.map((start) => start.e),
  ]);
  const eventNames: Record<number, string> = {};
  const eventDates: Record<number, string> = {};
  for (const no of numbers) {
    eventNames[no] = eventTitle(meet, no);
    const event = meet.events.find((item) => item.no === no);
    const section = event && meet.sections.find((item) => item.no === event.section);
    if (section?.date) eventDates[no] = section.date;
  }
  const sexOf = (start: { s: string; e: number; n: string }): string => {
    if (start.s === 'M' || start.s === 'W') return start.s;
    const event = meet.events.find((item) => item.no === start.e);
    if (event && (event.sex === 'M' || event.sex === 'W')) return event.sex;
    const known = sexes.get(nameToken(start.n));
    return known === 'M' || known === 'W' ? known : '';
  };
  const starts: EvalStart[] = meet.schedule.starts.map((start) => ({
    e: start.e,
    l: start.l,
    b: start.b,
    n: start.n,
    s: sexOf(start),
    j: start.j,
  }));
  const results: Record<string, EvalResult> = {};
  for (const [key, result] of Object.entries(meet.schedule.results)) {
    results[key] = { t: result.t, place: result.place, status: result.status };
  }
  return {
    id: meet.id,
    title: meet.title,
    place: meet.place,
    date: dateOf(meet),
    pool: meet.pool,
    eventNames,
    eventDates,
    starts,
    results,
    relayPlaces: meet.schedule.relayResults.map((relay) => relay.place),
    judges: meet.schedule.duties
      .filter((duty) => duty.name.trim() && !/^N\s?N$/i.test(duty.name.trim()))
      .map((duty) => ({ name: displayName(duty.name.trim()), section: duty.a })),
    fee,
  };
}

export function toEvalMember(member: Member): EvalMember {
  return {
    name: `${member.firstName} ${member.lastName}`,
    birthYear: birthYear(member),
    sex: member.sex,
    entry: member.entry,
    exit: member.exitDate,
    groups: member.swimmerGroupIds.map((id) => GROUPS.find((group) => group.id === id)?.name ?? id),
  };
}
