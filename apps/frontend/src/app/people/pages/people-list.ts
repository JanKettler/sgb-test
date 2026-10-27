import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupChips } from '../../ui/group-chips';
import { Icon } from '../../ui/icon';
import { ModalDialog } from '../../ui/modal-dialog';
import { fullDate } from '../../training/training-dates';
import { EvidenceRow, statusOf } from '../people-evidence';
import { downloadText } from '../../training/training-download';
import { GROUPS, GroupId } from '../../training/training.models';
import { fullName, Member, ROLES, RoleKey } from '../people.models';
import { PeopleStore } from '../people.store';
import { EvidenceTable } from './evidence-table';
import { ParentsTable } from './parents-table';

type Tab = 'members' | 'parents' | 'evidence';
type StatusFilter = 'active' | 'all' | 'inactive';
type SortKey = 'name' | 'memberNo';

const PAGE_SIZE = 25;

/** Evidence of one role, reduced to the most urgent hint for the list. */
export interface RoleHint {
  tone: string;
  text: string;
}

@Component({
  selector: 'app-people-list',
  imports: [RouterLink, Icon, GroupChips, ModalDialog, ParentsTable, EvidenceTable],
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
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDesc = signal(false);
  protected readonly page = signal(0);
  protected readonly openId = signal('');
  protected readonly toDelete = signal<Member | null>(null);
  protected readonly fullDate = fullDate;

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
        const order =
          this.sortKey() === 'memberNo'
            ? a.memberNo - b.memberNo
            : a.lastName.localeCompare(b.lastName, 'de') ||
              a.firstName.localeCompare(b.firstName, 'de');
        return this.sortDesc() ? -order : order;
      })
      .map((member) => {
        const evidence = this.store.evidenceOf(member);
        return {
          member,
          name: fullName(member),
          status: this.store.statusOf(member),
          swimmer: this.hint(evidence, 'Schwimmer'),
          trainer: this.hint(evidence, 'Trainer'),
          referee: this.hint(evidence, 'Kampfrichter'),
          evidence,
        };
      });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)),
  );
  protected readonly pageRows = computed(() => {
    const start = Math.min(this.page(), this.pageCount() - 1) * PAGE_SIZE;
    return this.rows().slice(start, start + PAGE_SIZE);
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

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) this.sortDesc.update((desc) => !desc);
    else {
      this.sortKey.set(key);
      this.sortDesc.set(false);
    }
  }

  protected sortMark(key: SortKey): string {
    return this.sortKey() !== key ? '' : this.sortDesc() ? '▼' : '▲';
  }

  protected toggle(id: string): void {
    this.openId.update((open) => (open === id ? '' : id));
  }

  protected goto(page: number): void {
    this.page.set(Math.max(0, Math.min(page, this.pageCount() - 1)));
  }

  protected resetPage(): void {
    this.page.set(0);
    this.openId.set('');
  }

  protected tone(value: string): string {
    return value === 'info' ? 'violet' : value;
  }

  protected confirmDelete(): void {
    const member = this.toDelete();
    if (!member) return;
    this.store.deleteMember(member.id);
    this.message.set(`${fullName(member)} wurde gelöscht.`);
    this.toDelete.set(null);
  }

  private hint(rows: EvidenceRow[], role: string): RoleHint | null {
    const status = statusOf(rows.filter((item) => item.role === role));
    return status.tone === 'ok' ? null : status;
  }

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
