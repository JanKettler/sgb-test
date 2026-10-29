import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DateField } from '../../ui/date-field';
import { Icon } from '../../ui/icon';
import { fullDate } from '../../training/training-dates';
import { GROUPS, GroupId } from '../../training/training.models';
import { EvidenceRow } from '../people-evidence';
import {
  APP_ROLES,
  AppRoleKey,
  LICENSE_KINDS,
  PayAccount,
  SPECIAL_RIGHTS,
  SpecialRightKey,
  Member,
  ROLES,
  RoleKey,
  birthYear,
  fullName,
  initials,
  isActive,
} from '../people.models';
import { FeesStore } from '../../fees/fees.store';
import { PeopleStore } from '../people.store';
import { PayAccountForm } from './pay-account';

type Tab = 'master' | 'roles' | 'family' | 'material' | 'payment' | 'access' | 'extra';
type TextKey =
  | 'firstName'
  | 'street'
  | 'houseNo'
  | 'zip'
  | 'city'
  | 'email1'
  | 'email2'
  | 'phone1'
  | 'phone2'
  | 'officialSince'
  | 'officialUntil'
  | 'startRight'
  | 'codeOfConductOn'
  | 'refereeAwUntil'
  | 'refereeSchUntil'
  | 'username'
  | 'loginEmail'
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
  imports: [RouterLink, Icon, DateField, PayAccountForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-editor.html',
  styleUrl: './person-editor.scss',
})
export class PersonEditor {
  private readonly store = inject(PeopleStore);
  private readonly router = inject(Router);
  protected readonly fees = inject(FeesStore);
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
  protected readonly appRoles = APP_ROLES;
  protected readonly specialRights = SPECIAL_RIGHTS;
  protected readonly notice = signal('');
  protected readonly payments = computed(() => this.fees.paymentsOf(this.draft().id));
  protected readonly feeName = (id: string): string => this.fees.feeName(id);
  private nextRow = 1;
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

  protected setDate(key: TextKey, value: string): void {
    this.draft.update((member) => ({ ...member, [key]: value }));
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

  protected readonly accessPill = computed(() => {
    const access = this.draft().access;
    return access === 'active'
      ? { css: 'pill is-ok', text: 'Zugang aktiv' }
      : access === 'blocked'
        ? { css: 'pill is-bad', text: 'Zugang gesperrt' }
        : { css: 'pill is-warn', text: 'Kein Zugang' };
  });

  protected setAccount(account: PayAccount): void {
    this.draft.update((member) => ({ ...member, account }));
  }

  protected setAccess(access: Member['access']): void {
    this.draft.update((member) => ({ ...member, access }));
  }

  protected toggleAppRole(key: AppRoleKey): void {
    this.draft.update((member) => ({
      ...member,
      appRoles: member.appRoles.includes(key)
        ? member.appRoles.filter((item) => item !== key)
        : [...member.appRoles, key],
    }));
  }

  protected toggleRight(key: SpecialRightKey): void {
    this.draft.update((member) => ({
      ...member,
      specialRights: member.specialRights.includes(key)
        ? member.specialRights.filter((item) => item !== key)
        : [...member.specialRights, key],
    }));
  }

  protected addMaterial(): void {
    this.draft.update((member) => ({
      ...member,
      material: [
        ...member.material,
        { id: `mat-${this.nextRow++}`, name: '', since: this.store.today },
      ],
    }));
  }

  protected setMaterial(id: string, key: 'name' | 'since', event: Event): void {
    const value = this.value(event);
    this.draft.update((member) => ({
      ...member,
      material: member.material.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }));
  }

  protected removeMaterial(id: string): void {
    this.draft.update((member) => ({
      ...member,
      material: member.material.filter((item) => item.id !== id),
    }));
  }

  protected addExtra(): void {
    this.draft.update((member) => ({
      ...member,
      extra: [...member.extra, { id: `x-${this.nextRow++}`, label: '', value: '' }],
    }));
  }

  protected setExtra(id: string, key: 'label' | 'value', event: Event): void {
    const value = this.value(event);
    this.draft.update((member) => ({
      ...member,
      extra: member.extra.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }));
  }

  protected removeExtra(id: string): void {
    this.draft.update((member) => ({
      ...member,
      extra: member.extra.filter((item) => item.id !== id),
    }));
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
    this.fees.generate();
    this.store.flash.set(`${fullName(member)} wurde gespeichert.`);
    void this.router.navigate(['/personen']);
  }
}
