import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { routes } from '../app.routes';
import { Status } from './status';

const token = 'A'.repeat(43); // Synthetic canonical test token; not issued to a real entry.
const endpoint = '/api/public/waitlist/status';

describe('Public waitlist status page', () => {
  let fixture: ComponentFixture<Status>;
  let http: HttpTestingController;
  let fragment: BehaviorSubject<string | null>;

  beforeEach(async () => {
    fragment = new BehaviorSubject<string | null>(token);
    await TestBed.configureTestingModule({
      imports: [Status],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { fragment } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function create(): void {
    fixture = TestBed.createComponent(Status);
    fixture.detectChanges();
  }
  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
  it('loads using only the request body, with privacy options and accessible pending state', () => {
    create();
    const request = http.expectOne({ method: 'POST', url: endpoint });
    expect(request.request.body).toEqual({ token });
    expect(request.request.cache).toBe('no-store');
    expect(request.request.referrerPolicy).toBe('no-referrer');
    expect(request.request.credentials).toBe('omit');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]'),
    ).not.toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent,
    ).toContain('wird geladen');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain(token);
    request.flush({ status: 'UNASSIGNED', group: null, position: null });
  });

  it('shows an informative unassigned state without inventing a position', () => {
    create();
    http.expectOne(endpoint).flush({ status: 'UNASSIGNED', group: null, position: null });
    fixture.detectChanges();
    expect(text()).toContain('Anmeldung eingegangen');
    expect(text()).toContain('Die Zuordnung zu einer Schwimmgruppe steht noch aus');
    expect(text()).not.toContain('Aktueller Warteplatz');
  });

  it.each(['GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4'])(
    'renders assigned group %s and no private fields',
    (group) => {
      create();
      http.expectOne(endpoint).flush({
        status: 'WAITING',
        group,
        position: 11,
        firstName: 'Private swimmer',
        email: 'private@example.invalid',
        internalNotes: 'Private notes',
      });
      fixture.detectChanges();
      expect(text()).toContain(`Gruppe ${group.slice(-1)}`);
      expect(text()).toContain('Aktueller Warteplatz');
      expect(text()).toContain('11');
      expect(text()).not.toMatch(/Private|private@example/);
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
      expect(text()).not.toMatch(/Zum Aktualisieren|Dieser Link ist|Der Warteplatz kann sich/);
    },
  );

  it.each([
    ['INVITED', 'Zum Probetraining eingeladen'],
    ['TRIAL_COMPLETED', 'Probetraining abgeschlossen'],
  ])('shows %s without a waiting position', (status, label) => {
    create();
    http.expectOne(endpoint).flush({ status, group: 'GROUP_4', position: null });
    fixture.detectChanges();
    expect(text()).toContain(label);
    expect(text()).not.toContain('Aktueller Warteplatz');
  });

  it('loads the current group and position when reopening the page', () => {
    create();
    http.expectOne(endpoint).flush({ status: 'WAITING', group: 'GROUP_4', position: 11 });
    fixture.detectChanges();
    fixture.destroy();
    create();
    const request = http.expectOne(endpoint);
    expect(request.request.body).toEqual({ token });
    expect(text()).not.toContain('Aktueller Warteplatz');
    request.flush({ status: 'WAITING', group: 'GROUP_3', position: 4 });
    fixture.detectChanges();
    expect(text()).toContain('Gruppe 3');
    expect(text()).not.toContain('Gruppe 4');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.has-text-weight-bold')?.textContent,
    ).toContain('4');
  });

  it.each([null, '', 'invalid', 'B'.repeat(43), 'A'.repeat(42), `${token}?id=1`])(
    'uses a neutral unavailable message for missing/malformed fragment (%#)',
    (value) => {
      fragment.next(value);
      create();
      http.expectNone(endpoint);
      expect(text()).toContain('Dieser Statuslink ist nicht verfügbar.');
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    },
  );

  it('shows the same neutral message for unknown, revoked or closed links without API error contents', () => {
    create();
    http
      .expectOne(endpoint)
      .flush({ message: `Secret ${token}` }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(text()).toContain('Dieser Statuslink ist nicht verfügbar.');
    expect(text()).not.toContain(token);
  });

  it('allows retry by reopening the page after a server error without rendering server details', () => {
    create();
    http
      .expectOne(endpoint)
      .flush({ message: 'Private server error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('gerade nicht geladen');
    expect(text()).not.toContain('Private');
    fixture.destroy();
    create();
    http.expectOne(endpoint).flush({ status: 'WAITING', group: 'GROUP_4', position: 2 });
    fixture.detectChanges();
    expect(text()).toContain('Auf der Warteliste');
  });

  it('handles network failures without logging or reflecting secrets', () => {
    create();
    http.expectOne(endpoint).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(text()).toContain('Der Status kann gerade nicht geladen werden.');
    expect(text()).not.toContain(token);
  });

  it('explains rate limiting without automatically retrying', () => {
    create();
    http.expectOne(endpoint).flush(null, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(text()).toContain('Bitte warte eine Minute');
    http.expectNone(endpoint);
  });

  it('times out a stalled lookup and cancels the request', () => {
    vi.useFakeTimers();
    create();
    const request = http.expectOne(endpoint);
    vi.advanceTimersByTime(10000);
    fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(text()).toContain('Der Status kann gerade nicht geladen werden.');
  });

  it.each([
    null,
    {},
    { status: 'UNKNOWN', group: null, position: null },
    { status: 'WAITING', group: 'GROUP_5', position: 1 },
    { status: 'WAITING', group: 'GROUP_4', position: 0 },
    { status: 'WAITING', group: 'GROUP_4', position: '1' },
    { status: 'UNASSIGNED', group: 'GROUP_4', position: 1 },
    { status: 'INVITED', group: 'GROUP_4', position: 1 },
  ])('rejects invalid success payloads (%#)', (response) => {
    create();
    http.expectOne(endpoint).flush(response);
    fixture.detectChanges();
    expect(text()).toContain('Der Status kann gerade nicht geladen werden.');
    expect(text()).not.toContain('Aktueller Warteplatz');
  });

  it('cancels the previous lookup when the fragment changes and clears old results', () => {
    create();
    const previous = http.expectOne(endpoint);
    const nextToken = 'E'.repeat(43);
    fragment.next(nextToken);
    expect(previous.cancelled).toBe(true);
    const next = http.expectOne(endpoint);
    expect(next.request.body).toEqual({ token: nextToken });
    next.flush({ status: 'WAITING', group: 'GROUP_4', position: 5 });
    fragment.next(null);
    fixture.detectChanges();
    expect(text()).toContain('Dieser Statuslink ist nicht verfügbar.');
    expect(text()).not.toContain('Aktueller Warteplatz');
  });

  it('cancels pending HTTP work when leaving the page', () => {
    create();
    const request = http.expectOne(endpoint);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
  });
});

describe('Public status routing', () => {
  it('opens the lazy status page without authentication and resolves its URL fragment', async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/warteliste/status#${token}`, Status);
    http.expectOne(endpoint).flush({ status: 'UNASSIGNED', group: null, position: null });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Anmeldung eingegangen');
    http.verify();
  });
});
