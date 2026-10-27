import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntryActions } from './entry-actions';

describe('EntryActions', () => {
  let fixture: ComponentFixture<EntryActions>;
  let http: HttpTestingController;
  const url = '/api/internal/waitlist/example';
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryActions],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EntryActions);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('entryId', 'example');
    fixture.detectChanges();
    http.expectOne(`${url}/details`).flush({
      internalNotes: 'Existing notes',
      statusLinkDelivery: { status: 'FAILED', attemptedAt: null, sentAt: null, canSend: true },
      groupHistoryIncomplete: false,
      history: [
        { id: 'registration', type: 'REGISTERED', createdAt: '2026-10-06T12:00:00Z' },
        {
          id: 'assignment',
          type: 'GROUP_ASSIGNED',
          group: 'GROUP_4',
          createdAt: '2026-10-07T11:00:00Z',
        },
        {
          id: 'transfer',
          type: 'GROUP_CHANGED',
          previousGroup: 'GROUP_4',
          group: 'GROUP_3',
          createdAt: '2026-10-07T11:30:00Z',
        },
        {
          id: 'history',
          type: 'POSITION_CHANGED',
          group: 'GROUP_4',
          previousPosition: 3,
          newPosition: 2,
          reason: '<script>Example</script>',
          createdAt: '2026-10-07T12:00:00Z',
        },
      ],
    });
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function submit(index: number): void {
    (fixture.nativeElement as HTMLElement)
      .querySelectorAll('form')
      [index].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('renders private notes and escapes the history reason', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLTextAreaElement>('#internal-notes')?.value).toBe(
      'Existing notes',
    );
    expect(element.textContent).toContain('Platz 3 → 2');
    expect(element.textContent).toContain('Anmeldung eingegangen');
    expect(element.textContent).toContain('Erste Gruppenzuteilung: Gruppe 4');
    expect(element.textContent).toContain('Gruppenwechsel: Gruppe 4 → Gruppe 3');
    expect(element.textContent).toContain('<script>Example</script>');
    expect(element.querySelector('script')).toBeNull();
  });

  it('clears notes independently from a move reason', () => {
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      '#internal-notes',
    )!.value = '   ';
    submit(0);
    const req = http.expectOne(`${url}/notes`);
    expect(req.request.body).toEqual({ internalNotes: '' });
    req.flush({ status: 'saved' });
    expect(changed).toHaveBeenCalledWith('Die internen Notizen wurden gespeichert.');
  });

  it('retries once, shows confirmation, and preserves unsaved notes while refreshing delivery', () => {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLTextAreaElement>('#internal-notes')!.value = 'Unsaved draft';
    const retry = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Versand erneut versuchen'),
    )!;
    retry.click();
    fixture.detectChanges();
    retry.click();
    http.expectOne({ method: 'POST', url: `${url}/status-link` }).flush({ status: 'sent' });
    http.expectOne(`${url}/details`).flush({
      internalNotes: 'Existing notes',
      history: [],
      statusLinkDelivery: { status: 'SENT', sentAt: '2026-10-11T12:00:00Z', canSend: false },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('vom Mailserver angenommen');
    expect(element.querySelector<HTMLTextAreaElement>('#internal-notes')?.value).toBe(
      'Unsaved draft',
    );
    expect(
      Array.from(element.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Versand erneut versuchen'),
      ),
    ).toBe(false);
  });

  it('handles conflicting sends and refreshes the state without exposing API errors', () => {
    const element = fixture.nativeElement as HTMLElement;
    Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Versand erneut versuchen'))!
      .click();
    http
      .expectOne(`${url}/status-link`)
      .flush({ message: 'Private SMTP details' }, { status: 409, statusText: 'Conflict' });
    http
      .expectOne(`${url}/details`)
      .flush({ history: [], statusLinkDelivery: { status: 'SENDING', canSend: false } });
    fixture.detectChanges();
    expect(element.textContent).toContain('Ein Versand läuft bereits');
    expect(element.textContent).not.toContain('Private SMTP');
  });

  it('shows uncertain attempts, replacement warning and mail history', () => {
    const element = fixture.nativeElement as HTMLElement;
    Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Versandstatus aktualisieren'))!
      .click();
    http.expectOne(`${url}/details`).flush({
      history: [{ id: 'mail', type: 'STATUS_LINK_SENT', createdAt: '2026-10-11T12:00:00Z' }],
      statusLinkDelivery: { status: 'UNKNOWN', canSend: true },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('Ausgang des letzten Versandversuchs ist unklar');
    expect(element.textContent).toContain('bisheriger Link wird dadurch ungültig');
    expect(element.textContent).toContain('Mail mit Statuslink vom Mailserver angenommen');
  });
});
