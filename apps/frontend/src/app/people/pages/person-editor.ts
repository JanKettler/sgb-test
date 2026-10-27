import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { fullDate } from '../../training/training-dates';
import { GROUPS, GroupId } from '../../training/training.models';
import { EvidenceRow } from '../people-evidence';
import {
  LICENSE_KINDS,
  Member,
  ROLES,
  RoleKey,
  birthYear,
  fullName,
  initials,
  isActive,
} from '../people.models';
import { PeopleStore } from '../people.store';

type Tab = 'master' | 'roles' | 'family';
type TextKey =
  | 'firstName'
  | 'birthDate'
  | 'exitDate'
  | 'lastName'
  | 'entry'
  | 'criminalRecordOn'
  | 'dsvId'
  | 'attestUntil'
  | 'licenseKind'
  | 'licenseNo'
  | 'licenseUntil'
  | 'firstAidUntil'
  | 'lifeSavingUntil'
  | 'fee'
  | 'iban'
  | 'bic'
  | 'refereeNo'
  | 'refereeUntil'
  | 'officialFunction';
type GroupKey = 'swimmerGroupIds' | 'trainerGroupIds';

@Component({
  selector: 'app-person-editor',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-editor.html',
  styleUrl: './person-editor.scss',
})
export class PersonEditor {
  private readonly store = inject(PeopleStore);
  private readonly router = inject(Router);
  private readonly parentsBefore = this.store.parents();
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly roles = ROLES;
  protected readonly groups = GROUPS;
  protected readonly licenseKinds = LICENSE_KINDS;
  protected readonly fullDate = fullDate;
  protected readonly year = birthYear;
  protected readonly tab = signal<Tab>('master');

  /** Working copy; it only reaches the store on "Speichern". */
  protected readonly draft = signal<Member>(this.load());
  protected readonly active = computed(() => isActive(this.draft(), this.store.today));
  protected readonly isNew = computed(() => !this.store.member(this.draft().id));
  protected readonly parents = computed(() => this.store.parentsOf(this.draft()));
  protected readonly siblings = computed(() => this.store.siblingsOf(this.draft()));
  protected readonly evidence = computed(() => this.store.allEvidenceOf(this.draft()));
  protected readonly chips = computed(() => this.store.roleChips(this.draft()));
  protected readonly name = computed(() => fullName(this.draft()) || 'Neue Person');
  protected readonly initials = computed(() => initials(this.draft()) || '+');
  protected readonly missingRoles = computed(() => ROLES.filter((role) => !this.draft()[role.key]));

  private load(): Member {
    const id = this.id();
    const existing = id ? this.store.member(id) : undefined;
    return existing ? structuredClone(existing) : this.store.newMember();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setText(key: TextKey, event: Event): void {
    this.draft.update((member) => ({ ...member, [key]: this.value(event) }));
  }

  protected setNumber(key: 'memberNo', event: Event): void {
    this.draft.update((member) => ({ ...member, [key]: Number(this.value(event)) || 0 }));
  }

  protected setRole(key: RoleKey, on: boolean): void {
    this.draft.update((member) => ({ ...member, [key]: on }));
  }

  protected toggleGroup(key: GroupKey, id: GroupId): void {
    this.draft.update((member) => {
      const current = member[key];
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      return { ...member, [key]: next };
    });
  }

  protected tone(row: EvidenceRow): string {
    return row.tone === 'info' ? 'violet' : row.tone;
  }

  protected setParentFlag(
    id: string,
    key: 'trainingRegistration' | 'competitionRegistration',
    on: boolean,
  ): void {
    this.store.updateParent(id, { [key]: on });
  }

  protected cancel(): void {
    this.store.parents.set(this.parentsBefore);
    void this.router.navigate(['/personen']);
  }

  protected save(): void {
    const member = this.draft();
    if (!member.firstName.trim() || !member.lastName.trim()) {
      this.tab.set('master');
      return;
    }
    this.store.save(member);
    this.store.flash.set(`${fullName(member)} wurde gespeichert.`);
    void this.router.navigate(['/personen']);
  }
}
