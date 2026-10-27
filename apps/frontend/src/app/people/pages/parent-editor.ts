import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { PayAccount, Parent, Relation, birthYear, fullName } from '../people.models';
import { FeesStore } from '../../fees/fees.store';
import { PeopleStore } from '../people.store';
import { PayAccountForm } from './pay-account';

const RELATIONS: readonly Relation[] = ['Mutter', 'Vater', 'Erziehungsberechtigte'];

/** Edit page for one parent or guardian, including the children they are linked to. */
@Component({
  selector: 'app-parent-editor',
  imports: [RouterLink, Icon, PayAccountForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-editor.html',
})
export class ParentEditor {
  private readonly store = inject(PeopleStore);
  private readonly router = inject(Router);
  private readonly fees = inject(FeesStore);
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly relations = RELATIONS;
  protected readonly draft = signal<Parent>(this.load());
  protected readonly childIds = signal<string[]>(this.loadChildren());
  protected readonly search = signal('');
  protected readonly invalid = signal(false);
  protected readonly payments = computed(() => this.fees.paymentsOf(this.draft().id));
  protected readonly feeName = (id: string): string => this.fees.feeName(id);

  protected readonly children = computed(() =>
    this.store
      .members()
      .filter((member) => this.childIds().includes(member.id))
      .map((member) => ({ id: member.id, name: fullName(member), no: member.memberNo })),
  );

  /** Members that can still be linked; only a few are shown to keep the list short. */
  protected readonly candidates = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return [];
    return this.store
      .members()
      .filter(
        (member) =>
          !this.childIds().includes(member.id) && fullName(member).toLowerCase().includes(term),
      )
      .slice(0, 6)
      .map((member) => ({ id: member.id, name: fullName(member), year: birthYear(member) }));
  });

  private load(): Parent {
    const existing = this.store.parents().find((parent) => parent.id === this.id());
    return existing ? { ...existing } : this.store.newParent();
  }

  private loadChildren(): string[] {
    const parent = this.store.parents().find((item) => item.id === this.id());
    return parent ? this.store.childrenOf(parent).map((child) => child.id) : [];
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected set<K extends 'name' | 'email'>(key: K, event: Event): void {
    this.draft.update((parent) => ({ ...parent, [key]: this.value(event) }));
  }

  protected setRelation(event: Event): void {
    this.draft.update((parent) => ({ ...parent, relation: this.value(event) as Relation }));
  }

  protected setFlag(key: 'trainingRegistration' | 'competitionRegistration', on: boolean): void {
    this.draft.update((parent) => ({ ...parent, [key]: on }));
  }

  protected setAccount(account: PayAccount): void {
    this.draft.update((parent) => ({ ...parent, account }));
  }

  protected addChild(id: string): void {
    this.childIds.update((ids) => [...ids, id]);
    this.search.set('');
  }

  protected removeChild(id: string): void {
    this.childIds.update((ids) => ids.filter((item) => item !== id));
  }

  protected invite(): void {
    this.draft.update((parent) => ({ ...parent, access: 'invited' }));
  }

  protected save(): void {
    const parent = this.draft();
    if (!parent.name.trim()) {
      this.invalid.set(true);
      return;
    }
    this.store.saveParent(parent, this.childIds());
    this.fees.generate();
    this.store.flash.set(`${parent.name} wurde gespeichert.`);
    void this.router.navigate(['/personen']);
  }

  protected cancel(): void {
    void this.router.navigate(['/personen']);
  }
}
