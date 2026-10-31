import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GroupChips } from '../../ui/group-chips';
import { Icon } from '../../ui/icon';
import { ModalDialog } from '../../ui/modal-dialog';
import { SortButton, SortState } from '../../ui/sort';
import { TablePager, pageOf } from '../../ui/table-pager';
import { Toasts } from '../../ui/toast';
import { downloadText } from '../../training/training-download';
import { GROUPS, GroupId } from '../../training/training.models';
import { birthYear, fullName, Member, ROLES, RoleKey } from '../people.models';
import { PeopleStore } from '../people.store';
import { EvidenceTable } from './evidence-table';
import { ParentsTable } from './parents-table';

type Tab = 'members' | 'parents' | 'evidence';
type StatusFilter = 'active' | 'all' | 'inactive';

@Component({
  selector: 'app-people-list',
  imports: [
    RouterLink,
    Icon,
    GroupChips,
    ModalDialog,
    ParentsTable,
    EvidenceTable,
    SortButton,
    TablePager,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people-list.html',
  styleUrl: './people-list.scss',
})
export class PeopleList {
  protected readonly store = inject(PeopleStore);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  protected readonly roles = ROLES;
  protected readonly groups = GROUPS;

  protected readonly tab = signal<Tab>('members');
  protected readonly search = signal('');
  protected readonly role = signal<RoleKey | ''>('');
  protected readonly group = signal<GroupId | ''>('');
  protected readonly status = signal<StatusFilter>('active');
  protected readonly sort = new SortState('name');
  protected readonly page = signal(0);
  protected readonly size = signal(25);
  protected readonly toDelete = signal<Member | null>(null);
  protected readonly year = birthYear;
  protected readonly rolesLabel = (chip: { label: string }): string => chip.label;

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const role = this.role();
    const group = this.group();
    const status = this.status();
    return this.store
      .members()
      .filter((member) => {
        if (status === 'active' && !member.active) return false;
        if (status === 'inactive' && member.active) return false;
        if (role && !member[role]) return false;
        if (
          group &&
          !member.swimmerGroupIds.includes(group) &&
          !member.trainerGroupIds.includes(group)
        )
          return false;
        return (
          !term || fullName(member).toLowerCase().includes(term) || String(member.memberNo) === term
        );
      })
      .sort((a, b) => {
        const byName =
          a.lastName.localeCompare(b.lastName, 'de') ||
          a.firstName.localeCompare(b.firstName, 'de');
        const order =
          this.sort.key() === 'memberNo'
            ? a.memberNo - b.memberNo
            : this.sort.key() === 'year'
              ? a.birthDate.localeCompare(b.birthDate)
              : byName;
        return this.sort.apply(order);
      })
      .map((member) => ({
        member,
        name: fullName(member),
        chips: this.store.roleChips(member),
        status: this.store.statusOf(member),
      }));
  });

  protected readonly pageRows = computed(() => pageOf(this.rows(), this.page(), this.size()));

  protected readonly tabs = computed(() => [
    {
      id: 'members' as const,
      label: 'Mitglieder',
      count: this.store.activeMembers().length,
      bad: false,
    },
    { id: 'parents' as const, label: 'Eltern', count: this.store.parents().length, bad: false },
    {
      id: 'evidence' as const,
      label: 'Ablaufende Nachweise',
      count: this.store.dueEvidence().length,
      bad: true,
    },
  ]);

  protected resetPage(): void {
    this.page.set(0);
  }

  protected tone(value: string): string {
    return value === 'info' ? 'violet' : value;
  }

  protected confirmDelete(): void {
    const member = this.toDelete();
    if (!member) return;
    this.store.deleteMember(member.id);
    this.toasts.saved(`${fullName(member)} wurde gelöscht`);
    this.toDelete.set(null);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected groupsText(ids: GroupId[]): string {
    return ids.map((id) => this.store.groupName(id)).join(', ');
  }

  protected importDemo(): void {
    this.toasts.show('Demo: Der Import aus WebClub ist im Testportal nicht aktiv', 'info');
  }

  protected exportCsv(): void {
    downloadText('Mitglieder.csv', this.store.membersCsv(this.rows().map((row) => row.member)));
  }

  protected duplicate(member: Member): void {
    const copy = this.store.duplicateMember(member.id);
    if (!copy) return;
    this.toasts.saved(`Kopie von ${fullName(member)} angelegt`);
    void this.router.navigate(['/personen', copy.id]);
  }
}
