import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Administration, calculateAge } from './administration';

describe('Administration', () => {
  let fixture: ComponentFixture<Administration>;
  let http: HttpTestingController;
  const url = '/api/internal/waitlist';
  const entry = {
    id: '83a6870d-6173-4b5f-bdce-d2a4b0334f93',
    firstName: 'Example',
    lastName: 'Swimmer',
    birthDate: '2016-02-29',
    email: 'example@example.com',
    badges: ['SEAHORSE'],
    swimmingStyles: ['BACKSTROKE'],
    message: '<script>example</script>',
    registeredAt: '2026-10-06T12:00:00Z',
    status: 'UNASSIGNED',
    group: null,
    position: null,
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Administration],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Administration);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows disabled access without rendering records', () => {
    http.expectOne(url).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('nicht freigeschaltet');
    expect((fixture.nativeElement as HTMLElement).querySelector('article')).toBeNull();
  });

  it('renders qualifications, dates, and escaped messages', () => {
    http.expectOne(url).flush([entry]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('29.02.2016');
    expect(element.textContent).toContain('Rücken');
    expect(element.textContent).toContain('<script>example</script>');
    expect(element.querySelector('script')).toBeNull();
  });

  it('saves a group and reloads server-calculated positions', () => {
    http.expectOne(url).flush([entry]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector<HTMLSelectElement>('select[id^="assignment-"]')!;
    select.value = 'GROUP_4';
    element.querySelector<HTMLButtonElement>('.assignment-button')!.click();
    const req = http.expectOne({ method: 'PATCH', url: `${url}/${entry.id}/group` });
    expect(req.request.body).toEqual({ group: 'GROUP_4' });
    req.flush({ status: 'assigned' });
    http.expectOne(url).flush([{ ...entry, status: 'WAITING', group: 'GROUP_4', position: 1 }]);
    fixture.detectChanges();
    expect(element.textContent).toContain('Die Gruppenzuteilung wurde gespeichert.');
    expect(element.textContent).toContain('Gruppe 4 (1)');
    expect(element.querySelector('article')).toBeNull();
  });

  it('filters without recalculating waiting positions', () => {
    http.expectOne(url).flush([
      { ...entry, group: 'GROUP_4', status: 'WAITING', position: 3 },
      { ...entry, id: 'other', firstName: 'Other' },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tab = Array.from(element.querySelectorAll<HTMLButtonElement>('.tabs button')).find(
      (button) => button.textContent?.includes('Gruppe 4'),
    )!;
    tab.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(element.querySelector('tbody tr')?.textContent).toContain('3');
    expect(element.querySelector('article')).toBeNull();
  });

  it('keeps the old state on a failed assignment', () => {
    http.expectOne(url).flush([entry]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLSelectElement>('select[id^="assignment-"]')!.value = 'GROUP_4';
    element.querySelector<HTMLButtonElement>('.assignment-button')!.click();
    http.expectOne(`${url}/${entry.id}/group`).flush(null, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'konnte nicht gespeichert werden',
    );
    expect(element.textContent).toContain('Noch kein Warteplatz');
  });

  it('counts only waiting entries and navigates details in queue order', () => {
    http.expectOne(url).flush([
      {
        ...entry,
        id: 'second',
        firstName: 'Second',
        status: 'WAITING',
        group: 'GROUP_4',
        position: 2,
      },
      { ...entry, id: 'invited', firstName: 'Invited', status: 'INVITED', group: 'GROUP_4' },
      {
        ...entry,
        id: 'first',
        firstName: 'First',
        status: 'WAITING',
        group: 'GROUP_4',
        position: 1,
      },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tab = Array.from(element.querySelectorAll<HTMLButtonElement>('.tabs button')).find(
      (button) => button.textContent?.includes('Gruppe 4'),
    )!;
    expect(tab.textContent).toContain('Gruppe 4 (2)');
    tab.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.querySelector('app-waitlist-position-editor')).toBeNull();
    const ids = Array.from(element.querySelectorAll('[id]'), (node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(element.querySelector('tbody tr')?.textContent).toContain('First');
    element.querySelector<HTMLButtonElement>('.entry-link')!.click();
    fixture.detectChanges();
    http
      .expectOne(`${url}/first/details`)
      .flush({ internalNotes: null, history: [], groupHistoryIncomplete: false });
    expect(element.querySelector('article h3')?.textContent).toContain('First');
    expect(element.querySelectorAll('article app-waitlist-position-editor')).toHaveLength(1);
    expect(element.querySelector<HTMLButtonElement>('.detail-pagination button')?.disabled).toBe(
      true,
    );
    element.querySelector<HTMLButtonElement>('.detail-pagination button:last-child')!.click();
    fixture.detectChanges();
    http
      .expectOne(`${url}/second/details`)
      .flush({ internalNotes: null, history: [], groupHistoryIncomplete: false });
    expect(element.querySelector('article h3')?.textContent).toContain('Second');
    expect(
      element.querySelector<HTMLButtonElement>('.detail-pagination button:last-child')?.disabled,
    ).toBe(true);
    element.querySelector<HTMLButtonElement>('.detail-pagination button')!.click();
    fixture.detectChanges();
    http
      .expectOne(`${url}/first/details`)
      .flush({ internalNotes: null, history: [], groupHistoryIncomplete: false });
    expect(element.querySelector('article h3')?.textContent).toContain('First');
    element.querySelector<HTMLButtonElement>('.detail-navigation > button')!.click();
    fixture.detectChanges();
    expect(tab.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('table')).not.toBeNull();
  });

  it('returns to the same group table when a detail entry is transferred', () => {
    http.expectOne(url).flush([{ ...entry, status: 'WAITING', group: 'GROUP_4', position: 1 }]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    Array.from(element.querySelectorAll<HTMLButtonElement>('.tabs button'))
      .find((button) => button.textContent?.includes('Gruppe 4'))!
      .click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.entry-link')!.click();
    fixture.detectChanges();
    http
      .expectOne(`${url}/${entry.id}/details`)
      .flush({ internalNotes: null, history: [], groupHistoryIncomplete: false });
    element.querySelector<HTMLSelectElement>('select[id^="assignment-"]')!.value = 'GROUP_3';
    element.querySelector<HTMLButtonElement>('.assignment-button')!.click();
    http.expectOne(`${url}/${entry.id}/group`).flush({ status: 'assigned' });
    http.expectOne(url).flush([{ ...entry, status: 'WAITING', group: 'GROUP_3', position: 1 }]);
    fixture.detectChanges();
    expect(element.querySelector('article')).toBeNull();
    expect(element.querySelector('caption')?.textContent).toContain('Gruppe 4');
    expect(element.textContent).toContain('Keine Wartenden in dieser Gruppe.');
  });
});

describe('calculateAge', () => {
  it('changes age on the birthday using calendar dates', () => {
    expect(calculateAge('2016-10-07', new Date(2026, 9, 6))).toBe(9);
    expect(calculateAge('2016-10-07', new Date(2026, 9, 7))).toBe(10);
    expect(calculateAge('2016-10-07', new Date(2026, 9, 8))).toBe(10);
  });
  it('handles leap-day birthdays without timezone conversion', () => {
    expect(calculateAge('2016-02-29', new Date(2026, 1, 28))).toBe(9);
    expect(calculateAge('2016-02-29', new Date(2026, 2, 1))).toBe(10);
  });
});
