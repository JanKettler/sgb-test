import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DateField } from '../../ui/date-field';
import { Icon } from '../../ui/icon';
import { Toasts } from '../../ui/toast';
import { Member, PayAccount, Parent, Relation, birthYear, fullName } from '../people.models';
import { FeesStore } from '../../fees/fees.store';
import { PeopleStore } from '../people.store';
import { PayAccountForm } from './pay-account';

type TextField =
  'name' | 'email' | 'email2' | 'street' | 'houseNo' | 'zip' | 'city' | 'phone1' | 'phone2';

const RELATIONS: readonly Relation[] = [
  'Mutter',
  'Vater',
  'Erziehungsberechtigte',
  'Andere Person',
];

/** Edit page for one parent or guardian, including the children they are linked to. */
@Component({
  selector: 'app-parent-editor',
  imports: [RouterLink, Icon, PayAccountForm, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parent-editor.html',
})
export class ParentEditor {
  private readonly store = inject(PeopleStore);
  private readonly router = inject(Router);
  private readonly fees = inject(FeesStore);
  private readonly toasts = inject(Toasts);
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly relations = RELATIONS;
  protected readonly draft = signal<Parent>(this.load());
  protected readonly childIds = signal<string[]>(this.loadChildren());
  protected readonly search = signal('');
  /** Children created here; they are only stored together with the parent. */
  protected readonly newKids = signal<Member[]>([]);
  protected readonly kidName = signal('');
  protected readonly kidBirth = signal('');
  protected readonly invalid = signal(false);
  protected readonly payments = computed(() => this.fees.paymentsOf(this.draft().id));
  protected readonly feeName = (id: string): string => this.fees.feeName(id);

  protected readonly children = computed(() =>
    [...this.store.members(), ...this.newKids()]
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

  protected set(key: TextField, event: Event): void {
    this.draft.update((parent) => ({ ...parent, [key]: this.value(event) }));
  }

  protected setDate(key: 'birthDate' | 'entry' | 'exitDate', iso: string): void {
    this.draft.update((parent) => ({ ...parent, [key]: iso }));
  }

  protected setMemberNo(event: Event): void {
    const number = Number(this.value(event).trim());
    this.draft.update((parent) => ({
      ...parent,
      memberNo: Number.isInteger(number) && number > 0 ? number : null,
    }));
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
    this.newKids.update((kids) => kids.filter((kid) => kid.id !== id));
  }

  /** Creates a child with the address, phone and e-mail of this parent; editable afterwards. */
  protected createChild(): void {
    const first = this.kidName().trim();
    if (!first) {
      this.toasts.failed('Bitte den Vornamen des Kindes eintragen');
      return;
    }
    const parent = this.draft();
    const base = this.store.newMember();
    const kid: Member = {
      ...base,
      memberNo: base.memberNo + this.newKids().length,
      firstName: first,
      lastName: parent.name.trim().split(/\s+/).slice(-1)[0] ?? '',
      birthDate: this.kidBirth(),
      street: parent.street,
      houseNo: parent.houseNo,
      zip: parent.zip,
      city: parent.city,
      email1: parent.email,
      email2: parent.email2,
      phone1: parent.phone1,
      phone2: parent.phone2,
      parentIds: [parent.id],
    };
    this.newKids.update((kids) => [...kids, kid]);
    this.childIds.update((ids) => [...ids, kid.id]);
    this.kidName.set('');
    this.kidBirth.set('');
  }

  protected invite(): void {
    this.draft.update((parent) => ({ ...parent, access: 'invited' }));
  }

  protected save(): void {
    const parent = this.draft();
    if (!parent.name.trim()) {
      this.invalid.set(true);
      this.toasts.failed('Bitte einen Namen eintragen');
      return;
    }
    this.newKids().forEach((kid) => this.store.save(kid));
    this.store.saveParent(parent, this.childIds());
    this.fees.generate();
    this.toasts.saved(`${parent.name} gespeichert`);
    void this.router.navigate(['/personen']);
  }

  protected cancel(): void {
    this.toasts.cancelled();
    void this.router.navigate(['/personen']);
  }
}
