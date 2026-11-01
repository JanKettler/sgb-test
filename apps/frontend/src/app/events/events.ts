import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TabDef, Tabs } from '../ui/tabs';
import { EventsStore } from './events.store';
import { EventsTab } from './pages/events-tab';
import { TemplatesTab } from './pages/templates-tab';

/** Club events with checklists and helpers, and the checklist templates. */
@Component({
  selector: 'app-events',
  imports: [Tabs, EventsTab, TemplatesTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events.html',
})
export class Events {
  private readonly store = inject(EventsStore);
  protected readonly tab = signal('events');
  protected readonly tabs = computed<TabDef[]>(() => [
    { id: 'events', label: 'Veranstaltungen' },
    ...(this.store.canEdit() ? [{ id: 'templates', label: 'Vorlagen' }] : []),
  ]);
  /** The templates are only for the board; anybody else stays on the events. */
  protected readonly shown = computed(() =>
    this.tabs().some((entry) => entry.id === this.tab()) ? this.tab() : 'events',
  );
}
