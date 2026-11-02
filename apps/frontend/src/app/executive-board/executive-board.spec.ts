import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TasksStore } from '../tasks/tasks.store';
import { fullDate } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { ExecutiveBoard } from './executive-board';
import { ExecutiveBoardStore } from './executive-board.store';

describe('ExecutiveBoard', () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ExecutiveBoard);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const articleOf = (element: HTMLElement, title: string) =>
    Array.from(element.querySelectorAll<HTMLElement>('article.item')).find((entry) =>
      entry.querySelector('.item-title')?.textContent?.includes(title),
    );

  function openTab(element: HTMLElement, name: string): void {
    const tab = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find((entry) =>
      entry.textContent?.includes(name),
    );
    tab?.click();
  }

  it('shows the tabs with the numbers that need attention', () => {
    const tabs = Array.from(root(create()).querySelectorAll('[role="tab"]')).map((tab) =>
      tab.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual(['Anträge 1', 'Sitzungen', 'Beschlüsse 1', 'Fristen']);
  });

  it('lists the motions with their state and shows the text with the table when opened', () => {
    const fixture = create();
    const element = root(fixture);
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
    const first = articleOf(element, 'Kostenübernahme');
    expect(first?.textContent).toContain('Eingereicht');
    expect(first?.querySelector('table')).toBeNull();
    labelled(element, 'Antrag Kostenübernahme Wettkampftraining aufklappen')?.click();
    fixture.detectChanges();
    const opened = articleOf(element, 'Kostenübernahme');
    expect(opened?.textContent).toContain('Zusätzliche Wasserzeit');
    expect(opened?.textContent).toContain('zusätzliche Bahn pro Woche');
    expect(opened?.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('searches the motions', () => {
    const fixture = create();
    const element = root(fixture);
    const search = element.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'trikots';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
  });

  it('prints a motion in the letterhead layout', () => {
    const fixture = create();
    const element = root(fixture);
    const written: string[] = [];
    const popup = {
      document: {
        open: () => undefined,
        write: (html: string) => written.push(html),
        close: () => undefined,
      },
    };
    const spy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    try {
      labelled(element, 'Antrag Trikots für die Wettkampfgruppe drucken')?.click();
    } finally {
      spy.mockRestore();
    }
    expect(written).toHaveLength(1);
    expect(written[0]).toContain('Antrag Trikots für die Wettkampfgruppe');
    expect(written[0]).toContain('Sehr geehrte Damen und Herren,');
    expect(written[0]).toContain('Jonas Weber');
  });

  it('adds a motion with the dialog', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Neuer Antrag')?.click();
    fixture.detectChanges();
    const title = element.querySelector('app-form-dialog input') as HTMLInputElement;
    title.value = 'Antrag Bahnmiete';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-form-dialog')).toBeNull();
    const store = TestBed.inject(ExecutiveBoardStore);
    const added = store.motions().find((entry) => entry.title === 'Antrag Bahnmiete');
    expect(added?.author).toBe('Maria');
    expect(added?.state).toBe('Entwurf');
    expect(element.querySelectorAll('article.item')).toHaveLength(3);
  });

  it('asks before a motion is deleted', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Antrag Kostenübernahme Wettkampftraining löschen')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-confirm-dialog')?.textContent).toContain('Antrag löschen?');
    labelled(element, 'Löschen')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
  });

  it('offers edit, delete and the decision only to the board', () => {
    const fixture = create();
    const element = root(fixture);
    expect(labelled(element, 'Antrag Trikots für die Wettkampfgruppe bearbeiten')).not.toBeNull();
    TestBed.inject(TrainingStore).role.set('trainer');
    fixture.detectChanges();
    expect(labelled(element, 'Antrag Trikots für die Wettkampfgruppe bearbeiten')).toBeNull();
    expect(labelled(element, 'Antrag Trikots für die Wettkampfgruppe löschen')).toBeNull();
    expect(labelled(element, 'Neuer Antrag')).toBeNull();
    expect(labelled(element, 'Antrag Trikots für die Wettkampfgruppe drucken')).not.toBeNull();
  });

  it('turns a passed motion into a decision with one click', () => {
    const fixture = create();
    const element = root(fixture);
    const store = TestBed.inject(ExecutiveBoardStore);
    expect(
      articleOf(element, 'Trikots')?.querySelector('[aria-label="Beschluss anlegen"]'),
    ).toBeNull();
    const submitted = store.motions().find((entry) => entry.id === 'a-1');
    store.saveMotion({ ...(submitted as NonNullable<typeof submitted>), state: 'Beschlossen' });
    fixture.detectChanges();
    articleOf(element, 'Kostenübernahme')
      ?.querySelector<HTMLElement>('[aria-label="Beschluss anlegen"]')
      ?.click();
    fixture.detectChanges();
    expect(store.resolutions().some((entry) => entry.motionId === 'a-1')).toBe(true);
    expect(articleOf(element, 'Kostenübernahme')?.textContent).toContain('Beschluss angelegt');
    expect(
      articleOf(element, 'Kostenübernahme')?.querySelector('[aria-label="Beschluss anlegen"]'),
    ).toBeNull();
  });

  it('starts the minutes with the agenda and shows them as a numbered outline', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Sitzungen');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
    const planned = articleOf(element, 'Geplant');
    planned?.querySelector<HTMLElement>('[aria-label="Protokoll beginnen"]')?.click();
    fixture.detectChanges();
    const store = TestBed.inject(ExecutiveBoardStore);
    expect(store.meetings().find((entry) => entry.id === 's-1')?.minutes).toContain(
      'Weihnachtsmarkt',
    );
    const labels = Array.from(articleOf(element, 'Geplant')?.querySelectorAll('.label-text') ?? []);
    expect(labels.map((label) => label.textContent)).toEqual(['1.', '2.', '3.', '4.']);
  });

  it('highlights the names in the minutes and draws their tables', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Sitzungen');
    fixture.detectChanges();
    const store = TestBed.inject(ExecutiveBoardStore);
    const done = store.meetings().find((entry) => entry.id === 's-2');
    labelled(element, `Vorstandssitzung vom ${fullDate(done?.date ?? '')} aufklappen`)?.click();
    fixture.detectChanges();
    const opened = articleOf(element, 'Durchgeführt');
    expect(opened?.querySelector('.mark')?.textContent).toBe('Jonas');
    expect(opened?.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(opened?.textContent).toContain('Protokollführung: Anna Brandt');
  });

  it('lists the decisions, filters the open ones and flags what is overdue', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Beschlüsse');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(3);
    expect(element.textContent).toContain('1 überfällig');
    expect(articleOf(element, 'Trikots')?.textContent).toContain('überfällig');
    (element.querySelector('.chip') as HTMLElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
  });

  it('marks a decision as done and puts another one on the task board', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Beschlüsse');
    fixture.detectChanges();
    const tasks = TestBed.inject(TasksStore);
    const before = tasks.tasks().length;
    articleOf(element, 'Hallenzeiten')
      ?.querySelector<HTMLElement>('[aria-label="Als Aufgabe anlegen"]')
      ?.click();
    fixture.detectChanges();
    expect(tasks.tasks()).toHaveLength(before + 1);
    const created = tasks.tasks().at(-1);
    expect(created).toMatchObject({
      title: 'Hallenzeiten im Winter verlängern',
      who: ['Maria', 'Anna'],
      link: '/vorstand',
    });
    expect(articleOf(element, 'Hallenzeiten')?.textContent).toContain('Aufgabe angelegt');
    expect(
      articleOf(element, 'Hallenzeiten')?.querySelector('[aria-label="Als Aufgabe anlegen"]'),
    ).toBeNull();
    labelled(element, 'Hallenzeiten im Winter verlängern als erledigt eintragen')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(ExecutiveBoardStore).openCount()).toBe(1);
    expect(articleOf(element, 'Hallenzeiten')?.textContent).toContain('Erledigt');
  });

  it('shows the deadlines, the nearest first', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Fristen');
    fixture.detectChanges();
    const rows = Array.from(element.querySelectorAll('article.item')).map((entry) =>
      entry.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Trikots für die Wettkampfgruppe bestellen');
    expect(rows[0]).toContain('3 Tg. überfällig');
    expect(rows[1]).toContain('Sitzung');
    expect(rows[1]).toContain('in 9 Tg.');
    expect(rows[2]).toContain('in 20 Tg.');
  });
});
