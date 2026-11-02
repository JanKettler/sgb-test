import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Toasts } from '../../../ui/toast';
import { addDays } from '../../training-dates';
import { TrainingStore } from '../../training.store';
import { SessionEditor } from './session-editor';

describe('SessionEditor, copy of a session', () => {
  /** The editor, opened with "Kopieren" for the first session of the sample data. */
  function create() {
    const query: Record<string, string> = {};
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
              get queryParamMap() {
                return convertToParamMap(query);
              },
            },
          },
        },
      ],
    });
    const store = TestBed.inject(TrainingStore);
    store.role.set('admin');
    const source = store.sessions()[0];
    query['kopie'] = source.id;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SessionEditor);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, store, source, navigate };
  }

  const field = (element: HTMLElement, id: string) =>
    element.querySelector<HTMLInputElement>(`#${id}`) as HTMLInputElement;

  /** Types digits into a field and lets the page react. */
  function type(fixture: ComponentFixture<SessionEditor>, id: string, digits: string): void {
    const input = field(fixture.nativeElement as HTMLElement, id);
    input.value = digits;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const german = (iso: string) => iso.split('-').reverse().join('.');
  const digits = (iso: string) => german(iso).replaceAll('.', '');
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /** A day well behind all sample sessions, so that nothing clashes with it. */
  const freeDay = (store: TrainingStore) =>
    addDays(
      store
        .sessions()
        .map((session) => session.date)
        .sort()
        .at(-1) ?? '',
      400,
    );

  function save(fixture: ComponentFixture<SessionEditor>): void {
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Speichern"]',
    );
    button?.click();
    fixture.detectChanges();
  }

  it('opens with an empty day and deadline and keeps the rest of the session', () => {
    const { element, source } = create();
    expect(squeezed(element.querySelector('h2'))).toBe('Termin kopieren');
    expect(field(element, 'edit-date').value).toBe('');
    expect(field(element, 'edit-deadline-date').value).toBe('');
    expect(field(element, 'edit-time').value).toBe(source.time);
    expect(squeezed(element.querySelector('.notification.is-link'))).toContain(
      'Das ist eine Kopie',
    );
  });

  it('puts the deadline as far before the chosen day as in the original', () => {
    const { fixture, element, store, source } = create();
    const day = freeDay(store);
    type(fixture, 'edit-date', digits(day));
    const daysBefore = (Date.parse(source.date) - Date.parse(source.deadlineDate)) / 86_400_000;
    const [year, month, date] = day.split('-').map(Number);
    const expected = new Date(Date.UTC(year, month - 1, date - daysBefore))
      .toISOString()
      .slice(0, 10);
    expect(field(element, 'edit-date').value).toBe(german(day));
    expect(field(element, 'edit-deadline-date').value).toBe(german(expected));
    expect(element.querySelector('.notification.is-link')).toBeNull();
  });

  it('keeps a deadline that was typed by hand when the day is chosen afterwards', () => {
    const { fixture, element, store } = create();
    type(fixture, 'edit-deadline-date', '01012031');
    type(fixture, 'edit-date', digits(freeDay(store)));
    expect(field(element, 'edit-deadline-date').value).toBe('01.01.2031');
  });

  it('refuses to save before the day is chosen', () => {
    const { fixture, element, store } = create();
    const before = store.sessions().length;
    save(fixture);
    expect(store.sessions()).toHaveLength(before);
    expect(squeezed(element.querySelector('.notification.is-danger'))).toContain(
      'Bitte Datum, Uhrzeit, Meldeschluss',
    );
    expect(TestBed.inject(Toasts).items().at(-1)?.kind).toBe('bad');
  });

  it('saves the copy on the chosen day with the time and groups of the original', () => {
    const { fixture, store, source, navigate } = create();
    const before = store.sessions().length;
    const day = freeDay(store);
    type(fixture, 'edit-date', digits(day));
    save(fixture);
    expect(store.sessions()).toHaveLength(before + 1);
    const created = store.sessions().find((session) => session.date === day);
    expect(created?.time).toBe(source.time);
    expect(created?.groupIds).toEqual(source.groupIds);
    expect(navigate).toHaveBeenCalledWith(['/training/termine'], {
      queryParams: { neu: created?.id },
    });
  });
});
