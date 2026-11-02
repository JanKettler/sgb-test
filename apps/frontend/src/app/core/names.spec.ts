import { describe, expect, it } from 'vitest';
import { firstName, sameOwner } from './names';

describe('names', () => {
  it('takes the first word of a name', () => {
    expect(firstName('Jonas Weber')).toBe('Jonas');
    expect(firstName('  Maria  ')).toBe('Maria');
    expect(firstName('')).toBe('');
  });

  it('matches names with an account that may hold only the first name', () => {
    expect(sameOwner('Jonas Weber', 'Jonas')).toBe(true);
    expect(sameOwner('Jonas Weber', 'jonas weber')).toBe(true);
    expect(sameOwner('Jonas Weber', 'Jonas Meier')).toBe(false);
    expect(sameOwner('Jonas', 'Jonas Weber')).toBe(false);
    expect(sameOwner('Maria', 'Maria')).toBe(true);
    expect(sameOwner('', 'Maria')).toBe(false);
    expect(sameOwner('Maria', '')).toBe(false);
  });
});
