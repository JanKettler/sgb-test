import { addDays } from '../training/training-dates';
import { evidenceOf, statusOf } from './people-evidence';
import { emptyMember } from './people.models';

const TODAY = '2027-03-10';

describe('evidence', () => {
  it('asks swimmers for a medical certificate', () => {
    const member = { ...emptyMember('m1', 1, TODAY), swimmerGroupIds: ['WK' as const] };
    expect(statusOf(evidenceOf(member, TODAY))).toEqual({
      tone: 'bad',
      text: 'Sportgesundheit fehlt',
    });
  });

  it('does not ask training swimmers for the certificate', () => {
    const member = { ...emptyMember('m1', 1, TODAY), swimmerGroupIds: ['G1' as const] };
    expect(evidenceOf(member, TODAY)).toHaveLength(0);
  });

  it('warns shortly before something expires and when it is over', () => {
    const member = {
      ...emptyMember('m1', 1, TODAY),
      swimmerGroupIds: ['WK' as const],
      attestUntil: addDays(TODAY, 21),
    };
    expect(statusOf(evidenceOf(member, TODAY))).toEqual({
      tone: 'warn',
      text: 'Sportgesundheit läuft in 21 Tagen ab',
    });
    const expired = { ...member, attestUntil: addDays(TODAY, -3) };
    expect(statusOf(evidenceOf(expired, TODAY)).tone).toBe('bad');
  });

  it('is fine when everything is valid', () => {
    const member = { ...emptyMember('m1', 1, TODAY), attestUntil: addDays(TODAY, 300) };
    expect(statusOf(evidenceOf(member, TODAY))).toEqual({ tone: 'ok', text: 'Alles gültig' });
  });

  it('needs the police clearance only once for several roles', () => {
    const member = {
      ...emptyMember('m1', 1, TODAY),
      swimmer: false,
      trainer: true,
      referee: true,
      official: true,
    };
    const kinds = evidenceOf(member, TODAY).map((row) => row.kind);
    expect(kinds.filter((kind) => kind === 'criminalRecord')).toHaveLength(1);
  });
});
