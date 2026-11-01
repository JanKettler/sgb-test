import { TestBed } from '@angular/core/testing';
import { FieldDef, FormDialog, FormValues, flagOf, listOf, numberOf, textOf } from './form-dialog';

describe('FormDialog', () => {
  const fields: FieldDef[] = [
    { key: 'title', label: 'Titel', required: true },
    { key: 'amount', label: 'Menge', type: 'number' },
    {
      key: 'kind',
      label: 'Art',
      type: 'select',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
    { key: 'who', label: 'Wer', type: 'tags' },
    { key: 'steps', label: 'Schritte', type: 'lines' },
    { key: 'done', label: 'Erledigt', type: 'checkbox' },
  ];

  function create(values: object = {}, check: ((values: FormValues) => string) | null = null) {
    const fixture = TestBed.createComponent(FormDialog);
    fixture.componentRef.setInput('heading', 'Test');
    fixture.componentRef.setInput('fields', fields);
    fixture.componentRef.setInput('values', values);
    fixture.componentRef.setInput('check', check);
    fixture.detectChanges();
    const saved: FormValues[] = [];
    fixture.componentInstance.saved.subscribe((result) => saved.push(result));
    const root = fixture.nativeElement as HTMLElement;
    const control = <T extends HTMLElement>(key: string) =>
      root.querySelector(`[id$="-${key}"]`) as T;
    const type = (key: string, text: string) => {
      const element = control<HTMLInputElement>(key);
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    };
    const save = () => {
      (root.querySelector('button[aria-label="Speichern"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, saved, root, control, type, save };
  }

  it('takes over the values of the record, lists written out', () => {
    const { control } = create({
      title: 'Hallenbad',
      amount: 4,
      who: ['Anna', 'Ben'],
      steps: ['eins', 'zwei'],
      done: true,
    });
    expect(control<HTMLInputElement>('title').value).toBe('Hallenbad');
    expect(control<HTMLInputElement>('amount').value).toBe('4');
    expect(control<HTMLInputElement>('who').value).toBe('Anna, Ben');
    expect(control<HTMLTextAreaElement>('steps').value).toBe('eins\nzwei');
  });

  it('shows the first choice of a select that has no value yet', () => {
    const { control } = create();
    expect(control<HTMLSelectElement>('kind').value).toBe('a');
  });

  it('does not save while a required field is empty', () => {
    const { saved, save, root: element } = create();
    save();
    expect(saved).toHaveLength(0);
    expect(element.textContent).toContain('Bitte alle Felder mit * ausfüllen.');
  });

  it('hands back text, numbers, lists and flags', () => {
    const { saved, save, type, control } = create();
    type('title', '  Neue Halle ');
    type('amount', '3.5');
    type('who', 'Anna, Ben;Carla');
    type('steps', 'eins\n\n zwei ');
    const kind = control<HTMLSelectElement>('kind');
    kind.value = 'b';
    kind.dispatchEvent(new Event('change'));
    control<HTMLInputElement>('done').click();
    save();
    expect(saved).toHaveLength(1);
    const values = saved[0];
    expect(textOf(values, 'title')).toBe('Neue Halle');
    expect(numberOf(values, 'amount')).toBe(3.5);
    expect(textOf(values, 'kind')).toBe('b');
    expect(listOf(values, 'who')).toEqual(['Anna', 'Ben', 'Carla']);
    expect(listOf(values, 'steps')).toEqual(['eins', 'zwei']);
    expect(flagOf(values, 'done')).toBe(true);
  });

  it('shows the message of the extra check and does not save', () => {
    const { saved, save, type, root: element } = create({}, () => 'Das passt nicht.');
    type('title', 'x');
    save();
    expect(saved).toHaveLength(0);
    expect(element.textContent).toContain('Das passt nicht.');
  });

  it('saves with Enter in a single line field', () => {
    const { saved, type, control } = create();
    type('title', 'Mit Enter');
    control<HTMLInputElement>('title').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(saved).toHaveLength(1);
  });

  it('reads numbers typed with a comma or a dot, and anything else as 0', () => {
    expect(numberOf({ amount: '3,5' }, 'amount')).toBe(3.5);
    expect(numberOf({ amount: ' 12.25 ' }, 'amount')).toBe(12.25);
    expect(numberOf({ amount: 'abc' }, 'amount')).toBe(0);
    expect(numberOf({}, 'amount')).toBe(0);
  });

  it('reads empty or missing values as nothing', () => {
    expect(numberOf({}, 'x')).toBe(0);
    expect(numberOf({ x: 'abc' }, 'x')).toBe(0);
    expect(textOf({}, 'x')).toBe('');
    expect(listOf({ x: 'a' }, 'x')).toEqual([]);
    expect(flagOf({}, 'x')).toBe(false);
  });
});
