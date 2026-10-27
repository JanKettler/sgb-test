import { Injectable, computed, inject, signal } from '@angular/core';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import { EvidenceRow, MemberStatus, evidenceOf, statusOf } from './people-evidence';
import { createPeopleSample } from './people-sample';
import { fullDate } from '../training/training-dates';
import {
  Member,
  Parent,
  ROLES,
  emptyAccount,
  emptyMember,
  fullName,
  isActive,
} from './people.models';

/** Byte order mark, so that Excel opens the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/**
 * In-memory stand-in for the future members API. The training module has its own small list of
 * people; the real database will join both.
 */
@Injectable({ providedIn: 'root' })
export class PeopleStore {
  private readonly training = inject(TrainingStore);
  readonly today = this.training.today;
  private readonly sample = createPeopleSample(this.today, this.training.people());
  private nextId = 1;

  readonly members = signal<Member[]>(this.sample.members);
  readonly parents = signal<Parent[]>(this.sample.parents);
  /** One-time message shown after saving on another page. */
  readonly flash = signal('');
  /** Hide evidence that was never entered, in every list. */
  readonly hideMissing = signal(false);
  /** Single evidence entries the user hid, as "memberId:kind". */
  readonly dismissed = signal<ReadonlySet<string>>(new Set());

  readonly activeMembers = computed(() => this.members().filter((member) => member.active));

  private readonly memberById = computed(
    () => new Map(this.members().map((member) => [member.id, member])),
  );

  /** Evidence of all active members, most urgent first. */
  readonly evidence = computed<EvidenceRow[]>(() =>
    this.activeMembers()
      .flatMap((member) => this.evidenceOf(member))
      .sort(
        (a, b) =>
          (a.days ?? Number.NEGATIVE_INFINITY) - (b.days ?? Number.NEGATIVE_INFINITY) ||
          a.member.lastName.localeCompare(b.member.lastName, 'de'),
      ),
  );

  /** Evidence that is missing, expired or runs out within 90 days. */
  readonly dueEvidence = computed(() =>
    this.evidence().filter((item) => item.missing || (item.days !== null && item.days <= 90)),
  );

  member(id: string): Member | undefined {
    return this.memberById().get(id);
  }

  parentsOf(member: Member): Parent[] {
    const ids = new Set(member.parentIds);
    return this.parents().filter((parent) => ids.has(parent.id));
  }

  childrenOf(parent: Parent): Member[] {
    return this.members().filter((member) => member.parentIds.includes(parent.id));
  }

  /** Siblings are members that share at least one parent. */
  siblingsOf(member: Member): Member[] {
    return this.members().filter(
      (other) =>
        other.id !== member.id && other.parentIds.some((id) => member.parentIds.includes(id)),
    );
  }

  roleChips(member: Member): { label: string; css: string }[] {
    return ROLES.filter((role) => member[role.key]);
  }

  statusOf(member: Member): MemberStatus {
    return statusOf(this.evidenceOf(member));
  }

  /** Evidence without what the user chose to hide. */
  evidenceOf(member: Member): EvidenceRow[] {
    const hidden = this.dismissed();
    const hideMissing = this.hideMissing();
    return this.allEvidenceOf(member).filter(
      (item) => !(hideMissing && item.missing) && !hidden.has(`${member.id}:${item.kind}`),
    );
  }

  /** All evidence, for the edit page where nothing may be hidden. */
  allEvidenceOf(member: Member): EvidenceRow[] {
    return evidenceOf(member, this.today);
  }

  dismiss(item: EvidenceRow): void {
    this.dismissed.update((all) => new Set(all).add(`${item.member.id}:${item.kind}`));
  }

  showDismissed(): void {
    this.dismissed.set(new Set());
  }

  newMember(): Member {
    const highest = Math.max(0, ...this.members().map((member) => member.memberNo));
    return emptyMember(`m-new-${this.nextId++}`, highest + 1, this.today);
  }

  save(input: Member): void {
    const member = { ...input, active: isActive(input, this.today) };
    const exists = this.memberById().has(member.id);
    this.members.update((all) =>
      exists ? all.map((item) => (item.id === member.id ? member : item)) : [...all, member],
    );
  }

  deleteMember(id: string): void {
    this.members.update((all) => all.filter((member) => member.id !== id));
  }

  newParent(): Parent {
    return {
      id: `e-new-${this.nextId++}`,
      name: '',
      relation: 'Mutter',
      email: '',
      access: 'invited',
      trainingRegistration: true,
      competitionRegistration: true,
      account: emptyAccount(),
    };
  }

  /** Saves a parent and links exactly the given children to them. */
  saveParent(parent: Parent, childIds: string[]): void {
    const exists = this.parents().some((item) => item.id === parent.id);
    this.parents.update((all) =>
      exists ? all.map((item) => (item.id === parent.id ? parent : item)) : [...all, parent],
    );
    this.members.update((all) =>
      all.map((member) => {
        const others = member.parentIds.filter((id) => id !== parent.id);
        const linked = childIds.includes(member.id);
        if (!linked && others.length === member.parentIds.length) return member;
        return { ...member, parentIds: linked ? [...others, parent.id] : others };
      }),
    );
  }

  deleteParent(id: string): void {
    this.parents.update((all) => all.filter((parent) => parent.id !== id));
    this.members.update((all) =>
      all.map((member) =>
        member.parentIds.includes(id)
          ? { ...member, parentIds: member.parentIds.filter((item) => item !== id) }
          : member,
      ),
    );
  }

  updateParent(id: string, change: Partial<Parent>): void {
    this.parents.update((all) =>
      all.map((parent) => (parent.id === id ? { ...parent, ...change } : parent)),
    );
  }

  /** Semicolon separated text with a BOM, so that Excel opens it correctly. */
  membersCsv(members: Member[]): string {
    const lines = [
      [
        'Mitgliedsnummer',
        'Name',
        'Geburtsdatum',
        'Rollen',
        'Schwimmer in',
        'Trainer in',
        'Nachweise',
      ],
      ...members.map((member) => [
        String(member.memberNo),
        fullName(member),
        fullDate(member.birthDate),
        this.roleChips(member)
          .map((role) => role.label)
          .join(', '),
        member.swimmerGroupIds.map((id) => this.training.groupName(id)).join(', '),
        member.trainerGroupIds.map((id) => this.training.groupName(id)).join(', '),
        this.statusOf(member).text,
      ]),
    ];
    return BOM + lines.map((line) => line.join(';')).join('\r\n');
  }

  groupName(id: GroupId): string {
    return this.training.groupName(id);
  }
}
