import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createApp() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture;
  }

  it('should render the title and pending connection status', () => {
    const fixture = createApp();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('SGB Portal');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Verbindung wird geprüft',
    );
    http.expectOne({ method: 'GET', url: '/api/health' }).flush({ status: 'ok' });
  });

  it('should show a successful connection after a healthy response', () => {
    const fixture = createApp();
    http.expectOne('/api/health').flush({ status: 'ok' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Verbindung hergestellt.');
  });

  it('should show an unavailable connection when the request fails', () => {
    const fixture = createApp();
    http.expectOne('/api/health').flush(null, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verbindung derzeit nicht verfügbar.',
    );
  });

  it('should not report an unhealthy response as connected', () => {
    const fixture = createApp();
    http.expectOne('/api/health').flush({ status: 'unhealthy' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verbindung derzeit nicht verfügbar.',
    );
  });
});
