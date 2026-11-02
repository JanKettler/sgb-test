import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { DocumentsStore } from './documents.store';

describe('DocumentsStore', () => {
  let store: DocumentsStore;

  beforeEach(() => {
    store = TestBed.inject(DocumentsStore);
  });

  it('sorts by area and then by title', () => {
    const list = store.sorted();
    const areas = list.map((item) => item.category);
    const firstOfEach = areas.filter((area, index) => areas.indexOf(area) === index);
    expect(firstOfEach[0]).toBe('Verein');
    const verein = list.filter((item) => item.category === 'Verein').map((item) => item.title);
    expect(verein).toEqual([...verein].sort((a, b) => a.localeCompare(b, 'de')));
  });

  it('adds, changes and removes an entry', () => {
    const before = store.documents().length;
    store.save({ id: '', title: 'Neu', category: 'Training', url: '', note: '' });
    expect(store.documents().length).toBe(before + 1);
    const added = store.documents().find((item) => item.title === 'Neu')!;
    expect(added.id).not.toBe('');
    store.save({ ...added, title: 'Geändert' });
    expect(store.documents().find((item) => item.id === added.id)?.title).toBe('Geändert');
    store.remove(added.id);
    expect(store.documents().length).toBe(before);
  });

  it('lets only the board change the list', () => {
    expect(store.canEdit()).toBe(true);
    TestBed.inject(TrainingStore).role.set('trainer');
    expect(store.canEdit()).toBe(false);
  });
});
