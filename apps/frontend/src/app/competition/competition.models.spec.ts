import {
  diffText,
  displayName,
  isRelayStart,
  maskTime,
  msToTime,
  showTime,
  splitCount,
  staffCount,
} from './competition.models';

describe('times on the pool deck', () => {
  it('sets colon and comma while digits are typed', () => {
    expect(maskTime('')).toBe('00:00,00');
    expect(maskTime('5')).toBe('00:00,05');
    expect(maskTime('13852')).toBe('01:38,52');
    expect(maskTime('000000')).toBe('00:00,00');
    expect(maskTime('01:38,52')).toBe('01:38,52');
  });

  it('shows times the short way and turns milliseconds into times', () => {
    expect(showTime('01:57,66')).toBe('1:57,66');
    expect(showTime('00:39,80')).toBe('39,80');
    expect(showTime('00:00,00')).toBe('');
    expect(msToTime(98520)).toBe('01:38,52');
    expect(msToTime(3120)).toBe('00:03,12');
    expect(msToTime(-5)).toBe('00:00,00');
  });

  it('tells how much faster or slower a swimmer was', () => {
    expect(diffText(-520)).toBe('−0,52');
    expect(diffText(1070)).toBe('+1,07');
    expect(diffText(61000)).toBe('+1:01,00');
    expect(diffText(0)).toBe('+0,00');
  });

  it('asks for intermediate times every 100 m from 200 m, but not in relays', () => {
    expect(splitCount(50, false)).toBe(0);
    expect(splitCount(100, false)).toBe(0);
    expect(splitCount(200, false)).toBe(1);
    expect(splitCount(400, false)).toBe(3);
    expect(splitCount(200, true)).toBe(0);
  });
});

describe('names and staff', () => {
  it('turns "Lastname, Firstname" around', () => {
    expect(displayName('Muster, Anna')).toBe('Anna Muster');
    expect(displayName('1. Mannschaft')).toBe('1. Mannschaft');
  });

  it('recognises relay teams and counts assignments per section', () => {
    expect(isRelayStart({ j: 'Staffel' })).toBe(true);
    expect(isRelayStart({ j: '2012' })).toBe(false);
    expect(staffCount({ 1: ['a', 'b'], 2: ['a'] })).toBe(3);
  });
});
