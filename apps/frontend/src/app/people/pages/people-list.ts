import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { downloadText } from '../../training/training-download';
import { GROUPS, GroupId } from '../../training/training.models';
import { fullName, ROLES, RoleKey } from '../people.models';
import { PeopleStore } from '../people.store';
import { EvidenceTable } from './evidence-table';
import { ParentsTable } from './parents-table';

type Tab = 'members' | 'parents' | 'evidence';
type StatusFilter = 'active' | 'all' | 'inactive';

@Component({
  selector: 'app-people-list',
  imports: [RouterLink, Icon, ParentsTable, EvidenceTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people-list.html',
  styleUrl: './people-list.scss',
})
export class PeopleList {
  protected readonly store = inject(PeopleStore);
  protected readonly roles = ROLES;
  protected readonly groups = GROUPS;

  protected readonly tab = signal<Tab>('members');
  protected readonly search = signal('');
  protected readonly role = signal<RoleKey | ''>('');
  protected readonly group = signal<GroupId | ''>('');
  protected readonly status = signal<StatusFilter>('active');
  protected readonly message = signal(this.takeFlash());

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
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
      .map((member) => ({
        member,
        name: fullName(member),
        chips: this.store.roleChips(member),
        status: this.store.statusOf(member),
      }));
  });

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

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected groupsText(ids: GroupId[]): string {
    return ids.map((id) => this.store.groupName(id)).join(', ');
  }

  protected exportCsv(): void {
    downloadText('Mitglieder.csv', this.store.membersCsv(this.rows().map((row) => row.member)));
  }

  private takeFlash(): string {
    const text = this.store.flash();
    this.store.flash.set('');
    return text;
  }
}
