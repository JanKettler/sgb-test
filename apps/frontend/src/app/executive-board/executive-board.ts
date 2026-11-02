import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TabDef, Tabs } from '../ui/tabs';
import { ExecutiveBoardStore } from './executive-board.store';
import { DeadlinesTab } from './pages/deadlines-tab';
import { MeetingsTab } from './pages/meetings-tab';
import { MotionsTab } from './pages/motions-tab';
import { ResolutionsTab } from './pages/resolutions-tab';

/** The board: motions, meetings with minutes, decisions and the deadlines that follow. */
@Component({
  selector: 'app-executive-board',
  imports: [Tabs, MotionsTab, MeetingsTab, ResolutionsTab, DeadlinesTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executive-board.html',
})
export class ExecutiveBoard {
  private readonly store = inject(ExecutiveBoardStore);
  protected readonly tab = signal('motions');
  protected readonly tabs = computed<TabDef[]>(() => [
    {
      id: 'motions',
      label: 'Anträge',
      count: this.store.motions().filter((motion) => motion.state === 'Eingereicht').length,
    },
    { id: 'meetings', label: 'Sitzungen' },
    { id: 'resolutions', label: 'Beschlüsse', count: this.store.overdueCount() },
    { id: 'deadlines', label: 'Fristen' },
  ]);
}
