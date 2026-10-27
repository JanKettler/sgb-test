import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Registration } from './registration';

describe('Registration', () => {
  let fixture: ComponentFixture<Registration>;
  let http: HttpTestingController;
  const endpoint = '/api/public/waitlist/registrations';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registration],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Registration);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function submit(): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function fill(): void {
    fixture.componentInstance.form.setValue({
      firstName: ' Test ',
      lastName: ' Swimmer ',
      birthDate: '2016-02-29',
      email: 'test@example.com',
      badges: ['DSA_BRONZE'],
      swimmingStyles: ['BREASTSTROKE'],
      message: '',
    });
  }

  it('shows required errors without submitting an empty form', () => {
    submit();
    http.expectNone(endpoint);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Bitte wähle mindestens ein Schwimmabzeichen',
    );
  });

  it('keeps checkbox selections in the form', () => {
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.form.controls.badges.value).toEqual(['SEAHORSE']);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.form.controls.badges.value).toEqual([]);
  });

  it('submits trimmed data once and clears personal data on success', () => {
    fill();
    submit();
    submit();
    const req = http.expectOne({ method: 'POST', url: endpoint });
    expect(req.request.body).toEqual({
      firstName: 'Test',
      lastName: 'Swimmer',
      birthDate: '2016-02-29',
      email: 'test@example.com',
      badges: ['DSA_BRONZE'],
      swimmingStyles: ['BREASTSTROKE'],
    });
    req.flush({ status: 'received' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Deine Anmeldung wurde gespeichert.',
    );
    expect(fixture.componentInstance.form.controls.firstName.value).toBe('');
  });

  it('preserves input and allows retry after an API validation error', () => {
    fill();
    submit();
    http
      .expectOne(endpoint)
      .flush({ message: ['invalid'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('Die Anmeldung konnte nicht gespeichert werden.');
    expect(fixture.componentInstance.form.controls.firstName.value).toBe('Test');
    expect(fixture.componentInstance.form.enabled).toBe(true);
    submit();
    http.expectOne(endpoint).flush({ status: 'received' });
  });

  it.each(['2017-02-29', '9999-01-01', '0000-01-01'])(
    'rejects invalid birth date %s',
    (birthDate) => {
      fill();
      fixture.componentInstance.form.controls.birthDate.setValue(birthDate);
      submit();
      http.expectNone(endpoint);
    },
  );
});
