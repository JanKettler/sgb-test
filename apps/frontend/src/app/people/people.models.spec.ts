import { emptyMember, isActive } from './people.models';

describe('isActive', () => {
  const today = '2026-10-27';

  it('is inactive without any role or group', () => {
    expect(isActive(emptyMember('x', 1, today), today)).toBe(false);
  });

  it('is active as swimmer with a group, or as trainer', () => {
    const swimmer = { ...emptyMember('x', 1, today), swimmerGroupIds: ['g1' as never] };
    expect(isActive(swimmer, today)).toBe(true);
    expect(isActive({ ...emptyMember('y', 2, today), swimmer: false, trainer: true }, today)).toBe(
      true,
    );
  });

  it('is inactive after the exit date', () => {
    const member = { ...emptyMember('x', 1, today), trainer: true, exitDate: '2026-01-01' };
    expect(isActive(member, today)).toBe(false);
  });
});
