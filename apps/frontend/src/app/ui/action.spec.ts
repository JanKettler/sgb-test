import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Action, ActionKind } from './action';

describe('Action', () => {
  function create(kind: ActionKind, inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Action);
    fixture.componentRef.setInput('kind', kind);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  const button = (root: HTMLElement) => root.querySelector('button') as HTMLButtonElement;

  it('shows the edit action as a yellow button named "Bearbeiten"', () => {
    const element = create('edit').nativeElement as HTMLElement;
    const edit = button(element);
    expect(edit.className).toContain('is-warning');
    expect(edit.getAttribute('aria-label')).toBe('Bearbeiten');
    expect(edit.title).toBe('Bearbeiten');
    expect(edit.type).toBe('button');
    expect(edit.textContent?.trim()).toBe('');
  });

  it('uses the same colour for the same action everywhere', () => {
    const tones: Record<string, string> = {
      add: 'is-success',
      save: 'is-success',
      delete: 'is-danger',
      cancel: 'is-danger',
    };
    for (const [kind, tone] of Object.entries(tones)) {
      TestBed.resetTestingModule();
      const element = create(kind as ActionKind).nativeElement as HTMLElement;
      expect(button(element).className).toContain(tone);
    }
  });

  it('names the action more precisely and shows the text on request', () => {
    const element = create('delete', { label: 'Termin löschen', withText: true, small: true })
      .nativeElement as HTMLElement;
    const remove = button(element);
    expect(remove.getAttribute('aria-label')).toBe('Termin löschen');
    expect(remove.className).toContain('is-small');
    expect(remove.textContent).toContain('Termin löschen');
  });

  it('emits when pressed, but not while it is disabled', () => {
    const fixture = create('save');
    const presses: MouseEvent[] = [];
    fixture.componentInstance.pressed.subscribe((event) => presses.push(event));
    const element = fixture.nativeElement as HTMLElement;
    button(element).click();
    expect(presses).toHaveLength(1);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    button(element).click();
    expect(presses).toHaveLength(1);
  });

  it('can be a submit button', () => {
    const element = create('save', { submit: true }).nativeElement as HTMLElement;
    expect(button(element).type).toBe('submit');
  });

  it('renders a link when a target is given', () => {
    const element = create('edit', { link: ['/personen', 'p-1'] }).nativeElement as HTMLElement;
    const link = element.querySelector('a') as HTMLAnchorElement;
    expect(element.querySelector('button')).toBeNull();
    expect(link.className).toContain('is-warning');
    expect(link.getAttribute('aria-label')).toBe('Bearbeiten');
  });
});
