import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { EntryActions } from './entry-actions';
import { PositionEditor } from './position-editor';

type Group = 'GROUP_1' | 'GROUP_2' | 'GROUP_3' | 'GROUP_4';
type Tab = Group | 'UNASSIGNED';

export function calculateAge(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const birthdayPending =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  return today.getFullYear() - year - (birthdayPending ? 1 : 0);
}
interface Entry {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  badges: string[];
  swimmingStyles: string[];
  message: string | null;
  registeredAt: string;
  status: string;
  group: Group | null;
  position: number | null;
}

@Component({
  selector: 'app-waitlist-administration',
  imports: [DatePipe, EntryActions, PositionEditor],
  templateUrl: './administration.html',
  styleUrl: './administration.scss',
})
export class Administration implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly entries = signal<Entry[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'disabled' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saved = signal('');
  protected readonly activeTab = signal<Tab>('UNASSIGNED');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly groups: { value: Group; label: string }[] = [
    { value: 'GROUP_1', label: 'Gruppe 1' },
    { value: 'GROUP_2', label: 'Gruppe 2' },
    { value: 'GROUP_3', label: 'Gruppe 3' },
    { value: 'GROUP_4', label: 'Gruppe 4 (Anfänger)' },
  ];
  protected readonly tabGroups = [...this.groups].reverse();
  protected readonly visibleEntries = computed(() => {
    const filter = this.activeTab();
    return this.entries()
      .filter((entry) =>
        filter === 'UNASSIGNED'
          ? entry.status === 'UNASSIGNED'
          : entry.group === filter && entry.status === 'WAITING',
      )
      .sort((left, right) =>
        filter.startsWith('GROUP_')
          ? (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER)
          : left.registeredAt.localeCompare(right.registeredAt) || left.id.localeCompare(right.id),
      );
  });
  protected readonly selectedIndex = computed(() =>
    this.visibleEntries().findIndex((entry) => entry.id === this.selectedId()),
  );
  protected readonly selectedEntry = computed(
    () => this.visibleEntries()[this.selectedIndex()] ?? null,
  );
  protected readonly cardEntries = computed(() => {
    const selected = this.selectedEntry();
    return selected ? [selected] : this.activeTab() === 'UNASSIGNED' ? this.visibleEntries() : [];
  });
  protected readonly age = calculateAge;

  protected count(tab: Tab): number {
    return this.entries().filter((entry) =>
      tab === 'UNASSIGNED'
        ? entry.status === 'UNASSIGNED'
        : entry.group === tab && entry.status === 'WAITING',
    ).length;
  }

  protected selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.selectedId.set(null);
  }

  protected navigateDetail(offset: number): void {
    const entry = this.visibleEntries()[this.selectedIndex() + offset];
    if (entry) this.selectedId.set(entry.id);
  }

  protected actionSaved(message: string): void {
    this.saved.set(message);
    this.load();
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.http
      .get<Entry[]>('/api/internal/waitlist')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.entries.set(entries);
          if (!this.selectedEntry()) this.selectedId.set(null);
          this.state.set('ready');
        },
        error: (error: HttpErrorResponse) => {
          this.entries.set([]);
          this.state.set(error.status === 404 ? 'disabled' : 'error');
        },
      });
  }

  protected assign(entry: Entry, group: string): void {
    if (this.saving() || !this.groups.some((option) => option.value === group)) return;
    this.saving.set(true);
    this.saveError.set('');
    this.saved.set('');
    this.http
      .patch('/api/internal/waitlist/' + entry.id + '/group', { group })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set('Die Gruppenzuteilung wurde gespeichert.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set(
            'Die Gruppenzuteilung konnte nicht gespeichert werden. Bitte lade die Liste neu und versuche es erneut.',
          );
        },
      });
  }

  protected label(value: string): string {
    const labels: Record<string, string> = {
      SEAHORSE: 'Seepferdchen',
      DSA_BRONZE: 'DSA Bronze',
      DSA_SILVER: 'DSA Silber',
      DSA_GOLD: 'DSA Gold',
      BUTTERFLY: 'Schmetterling',
      BACKSTROKE: 'Rücken',
      BREASTSTROKE: 'Brust',
      FREESTYLE: 'Kraul',
      UNASSIGNED: 'Noch nicht zugeteilt',
      WAITING: 'Wartend',
      INVITED: 'Zum Probetraining eingeladen',
      TRIAL_COMPLETED: 'Probetraining abgeschlossen',
      ACCEPTED: 'Aufgenommen',
      CANCELLED: 'Abgesagt',
      GROUP_1: 'Gruppe 1',
      GROUP_2: 'Gruppe 2',
      GROUP_3: 'Gruppe 3',
      GROUP_4: 'Gruppe 4 (Anfänger)',
    };
    return labels[value] ?? 'Unbekannt';
  }
}
