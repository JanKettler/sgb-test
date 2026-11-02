import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrainingStore } from '../../../training/training.store';
import { CompetitionStore } from '../../competition.store';
import { CompetitionList } from './competition-list';

describe('CompetitionList', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(TrainingStore).role.set(role);
    const fixture = TestBed.createComponent(CompetitionList);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('lists every meet and links the title to the view of the meet', () => {
    const fixture = create();
    const element = root(fixture);
    const store = TestBed.inject(CompetitionStore);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(store.competitions().length);
    const title = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.meet-title')).find(
      (link) => squeezed(link) === 'Hunte-Pokal',
    );
    expect(title?.getAttribute('href')).toBe('/wettkampf/wettkaempfe/c-1/ansehen');
  });

  it('offers to view a meet to everybody, to change it only to trainers and the board', () => {
    const board = root(create('admin'));
    expect(labelled(board, 'Hunte-Pokal ansehen')?.getAttribute('href')).toBe(
      '/wettkampf/wettkaempfe/c-1/ansehen',
    );
    expect(labelled(board, 'Hunte-Pokal bearbeiten')?.getAttribute('href')).toBe(
      '/wettkampf/wettkaempfe/c-1',
    );
    expect(labelled(board, 'Hunte-Pokal löschen')).not.toBeNull();
    expect(labelled(board, 'Wettkampf von Hand anlegen')).not.toBeNull();

    const parent = root(create('parent'));
    expect(labelled(parent, 'Hunte-Pokal ansehen')).not.toBeNull();
    expect(labelled(parent, 'Hunte-Pokal bearbeiten')).toBeNull();
    expect(labelled(parent, 'Hunte-Pokal löschen')).toBeNull();
    expect(labelled(parent, 'Wettkampf von Hand anlegen')).toBeNull();
  });

  it('asks before a meet is deleted', () => {
    const fixture = create();
    const element = root(fixture);
    const store = TestBed.inject(CompetitionStore);
    labelled(element, 'Nikolausschwimmen löschen')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-confirm-dialog')?.textContent).toContain(
      'Wettkampf löschen?',
    );
    labelled(element, 'Abbrechen')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-confirm-dialog')).toBeNull();
    expect(store.competition('c-2')).toBeDefined();

    labelled(element, 'Nikolausschwimmen löschen')?.click();
    fixture.detectChanges();
    labelled(element, 'Löschen')?.click();
    fixture.detectChanges();
    expect(store.competition('c-2')).toBeUndefined();
    expect(labelled(element, 'Nikolausschwimmen löschen')).toBeNull();
  });
});
