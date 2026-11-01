import { Injectable, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../../people/people.store';
import { seasonOf } from '../competition-sample';
import { CompetitionStore } from '../competition.store';
import { Evaluation, defaultConfig } from './evaluation.logic';
import { sexByName, toEvalMeet, toEvalMember } from './evaluation.mapper';
import { EvalConfig, PointList } from './evaluation.model';
import { WaSet } from './wa-points';
import { sampleWaSets } from './wa-sample';

/**
 * Everything the yearly evaluation needs besides the meets: base times, imported point lists, the
 * group settings and the corrections typed on the page. The meets and members come from the
 * other stores; in-memory like the rest of the test portal.
 */
@Injectable({ providedIn: 'root' })
export class EvaluationStore {
  private readonly meets = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  readonly today = this.meets.today;

  readonly waSets = signal<WaSet[]>(sampleWaSets(seasonOf(this.today), this.today));
  readonly lists = signal<PointList[]>([]);
  readonly config = signal<EvalConfig>(defaultConfig());
  /** Entry fees typed by hand, per meet. */
  readonly fees = signal<Record<string, number>>({});
  /** Judges that do not count in the statistic. */
  readonly excluded = signal<string[]>([]);

  /** All calculations on the current data; a new object whenever any of it changes. */
  readonly evaluation = computed(() => {
    const sexes = sexByName(this.people.members());
    return new Evaluation({
      meets: this.meets.competitions().map((meet) => toEvalMeet(meet, this.feeOf(meet.id), sexes)),
      members: this.people.members().map(toEvalMember),
      waSets: this.waSets(),
      lists: this.lists(),
      config: this.config(),
      clubName: this.meets.club.name,
      today: this.today,
      fees: this.fees(),
      excluded: this.excluded(),
    });
  });

  /** The fee of the entries in the portal, null while there are none to add up. */
  private feeOf(id: string): number | null {
    const meet = this.meets.competition(id);
    if (!meet) return null;
    const any =
      this.meets.entries().some((entry) => entry.competitionId === id) ||
      this.meets.relaysOf(id).length > 0;
    return any ? this.meets.totalFee(meet) : null;
  }

  /** Sets the fee of a meet by hand; an empty value goes back to the sum of the entries. */
  setFee(id: string, value: number | null): void {
    this.fees.update((all) => {
      const next = { ...all };
      if (value === null || Number.isNaN(value) || value < 0) delete next[id];
      else next[id] = Math.round(value * 100) / 100;
      return next;
    });
  }

  toggleJudge(name: string): void {
    this.excluded.update((all) =>
      all.includes(name) ? all.filter((item) => item !== name) : [...all, name],
    );
  }

  /** Pool length for a meet that has none: without it no points can be worked out. */
  setPool(id: string, pool: 25 | 50): void {
    const meet = this.meets.competition(id);
    if (meet) this.meets.save({ ...meet, pool });
  }

  /** Stores base time tables; a table of the same course and year is replaced. */
  saveWaSets(sets: WaSet[]): void {
    this.waSets.update((all) => [
      ...all.filter((old) => !sets.some((set) => set.id === old.id)),
      ...sets,
    ]);
  }

  removeWaSet(id: string): void {
    this.waSets.update((all) => all.filter((set) => set.id !== id));
  }

  /** A points list replaces the one of the same season and pool. */
  saveList(list: PointList): void {
    this.lists.update((all) => [
      ...all.filter((old) => !(old.jahr === list.jahr && old.bahn === list.bahn)),
      list,
    ]);
  }

  removeList(id: string): void {
    this.lists.update((all) => all.filter((list) => list.id !== id));
  }

  setConfig(change: Partial<EvalConfig>): void {
    this.config.update((old) => ({ ...old, ...change }));
  }
}
