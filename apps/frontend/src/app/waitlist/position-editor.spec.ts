import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PositionEditor } from './position-editor';

describe('PositionEditor', () => {
  let fixture: ComponentFixture<PositionEditor>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let dialog: HTMLDialogElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PositionEditor],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PositionEditor);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('entryId', 'example');
    fixture.componentRef.setInput('group', 'GROUP_4');
    fixture.componentRef.setInput('position', 2);
    fixture.componentRef.setInput('queueLength', 3);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    dialog = element.querySelector('dialog')!;
    // The DOM test environment does not implement native modal behavior.
    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: vi.fn(() => dialog.setAttribute('open', '')),
    });
    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: vi.fn(() => dialog.removeAttribute('open')),
    });
  });
  afterEach(() => http.verify());
  function open(): void {
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
  }
  function submit(): void {
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('opens only on demand and cancels without a request', () => {
    expect(dialog.open).toBe(false);
    open();
    expect(dialog.open).toBe(true);
    expect(element.querySelector<HTMLInputElement>('#target-position-example')?.value).toBe('2');
    element.querySelector<HTMLButtonElement>('dialog button')!.click();
    expect(dialog.open).toBe(false);
    http.expectNone('/api/internal/waitlist/example/position');
  });
  it('requires a separate reason, saves once, and closes on success', () => {
    open();
    element.querySelector<HTMLInputElement>('#target-position-example')!.value = '1';
    submit();
    http.expectNone('/api/internal/waitlist/example/position');
    expect(element.textContent).toContain('Bitte gib eine Begründung');
    element.querySelector<HTMLTextAreaElement>('#move-reason-example')!.value = ' Example ';
    submit();
    submit();
    const req = http.expectOne('/api/internal/waitlist/example/position');
    expect(req.request.body).toEqual({
      group: 'GROUP_4',
      previousPosition: 2,
      position: 1,
      reason: 'Example',
    });
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    req.flush({ status: 'moved' });
    expect(dialog.open).toBe(false);
  });
  it('keeps the dialog and draft open on a stale-position error', () => {
    open();
    element.querySelector<HTMLInputElement>('#target-position-example')!.value = '1';
    element.querySelector<HTMLTextAreaElement>('#move-reason-example')!.value = 'Reason';
    submit();
    http
      .expectOne('/api/internal/waitlist/example/position')
      .flush(null, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'zwischenzeitlich geändert',
    );
    expect(element.querySelector<HTMLTextAreaElement>('#move-reason-example')?.value).toBe(
      'Reason',
    );
  });
  it.each(['0', '4', '1.5', '2'])('rejects target %s', (position) => {
    open();
    element.querySelector<HTMLInputElement>('#target-position-example')!.value = position;
    element.querySelector<HTMLTextAreaElement>('#move-reason-example')!.value = 'Reason';
    submit();
    http.expectNone('/api/internal/waitlist/example/position');
  });
});
