import { pageOf } from './table-pager';

describe('pageOf', () => {
  const rows = Array.from({ length: 23 }, (_, index) => index + 1);

  it('returns the rows of one page', () => {
    expect(pageOf(rows, 0, 10)).toHaveLength(10);
    expect(pageOf(rows, 2, 10)).toEqual([21, 22, 23]);
  });

  it('shows everything when the size is 0', () => {
    expect(pageOf(rows, 3, 0)).toHaveLength(23);
  });

  it('falls back to the last page when the page is too high', () => {
    expect(pageOf(rows, 9, 10)).toEqual([21, 22, 23]);
  });
});
