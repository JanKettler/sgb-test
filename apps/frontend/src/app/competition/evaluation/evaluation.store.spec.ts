import { TestBed } from '@angular/core/testing';
import { seasonOf } from '../competition-sample';
import { EvaluationStore } from './evaluation.store';

describe('EvaluationStore', () => {
  it('works out the demo season of the sample meets', () => {
    const store = TestBed.inject(EvaluationStore);
    const year = String(seasonOf(store.today));
    const ev = store.evaluation();
    expect(ev.years()).toEqual([year]);
    expect(ev.ranking(year, 'best').length).toBeGreaterThan(5);
    expect(ev.stat(year).count).toBe(3);
  });

  it('keeps a fee typed by hand and goes back to the sum of the entries', () => {
    const store = TestBed.inject(EvaluationStore);
    const year = String(seasonOf(store.today));
    const fee = () =>
      store
        .evaluation()
        .stat(year)
        .events.find((row) => row.id === 'c-s1')!;
    const before = fee();
    expect(before.manual).toBe(false);
    store.setFee('c-s1', 99.5);
    expect(fee()).toMatchObject({ fee: 99.5, manual: true });
    store.setFee('c-s1', null);
    expect(fee()).toMatchObject({ fee: before.fee, manual: false });
  });

  it('leaves out a judge that does not count and brings him back', () => {
    const store = TestBed.inject(EvaluationStore);
    const year = String(seasonOf(store.today));
    const name = store.evaluation().stat(year).judges[0].name;
    store.toggleJudge(name);
    expect(
      store
        .evaluation()
        .stat(year)
        .judges.find((row) => row.name === name)!.excluded,
    ).toBe(true);
    store.toggleJudge(name);
    expect(
      store
        .evaluation()
        .stat(year)
        .judges.find((row) => row.name === name)!.excluded,
    ).toBe(false);
  });

  it('sets the pool length of a meet', () => {
    const store = TestBed.inject(EvaluationStore);
    const year = String(seasonOf(store.today));
    store.setPool('c-s1', 50);
    const row = store
      .evaluation()
      .stat(year)
      .events.find((item) => item.id === 'c-s1')!;
    expect(row.poolMeters).toBe(50);
  });

  it('replaces base times of the same course and year', () => {
    const store = TestBed.inject(EvaluationStore);
    const first = store.waSets()[0];
    store.saveWaSets([{ ...first, file: 'neu.csv' }]);
    expect(
      store
        .waSets()
        .filter((set) => set.id === first.id)
        .map((set) => set.file),
    ).toEqual(['neu.csv']);
    store.removeWaSet(first.id);
    expect(store.waSets().some((set) => set.id === first.id)).toBe(false);
  });

  it('takes the new group settings into the calculation', () => {
    const store = TestBed.inject(EvaluationStore);
    store.setConfig({ masters: 40, mergeMax: 0 });
    expect(store.evaluation().masters()).toBe(40);
    expect(store.evaluation().mergeMax()).toBe(0);
  });
});
