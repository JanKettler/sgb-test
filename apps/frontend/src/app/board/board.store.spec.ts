import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { titleOf } from './board.models';
import { BoardStore } from './board.store';

describe('BoardStore', () => {
  it('shows important messages first and keeps expired ones in the archive', () => {
    const store = TestBed.inject(BoardStore);
    expect(store.live()[0].important).toBe(true);
    expect(store.live().every((post) => !store.expired(post))).toBe(true);
    expect(store.archive().some((entry) => entry.reason === 'expired')).toBe(true);
  });

  it('saves a new message and removes it again', () => {
    const store = TestBed.inject(BoardStore);
    const post = { ...store.newPost(), html: 'Test' };
    store.save(post);
    expect(store.live().some((item) => item.id === post.id)).toBe(true);
    store.remove(post.id);
    expect(store.posts().some((item) => item.id === post.id)).toBe(false);
    expect(store.archive().some((entry) => entry.post.id === post.id)).toBe(true);
    store.restore(post.id);
    expect(store.live().some((item) => item.id === post.id)).toBe(true);
  });
});

describe('BoardStore audience', () => {
  it('hides messages for other roles from parents but not from authors', () => {
    const store = TestBed.inject(BoardStore);
    const post = { ...store.newPost(), html: 'Nur Trainer', roles: ['trainer' as const] };
    store.save(post);
    expect(store.live().some((item) => item.id === post.id)).toBe(true);
    TestBed.inject(TrainingStore).role.set('parent');
    expect(store.live().some((item) => item.id === post.id)).toBe(false);
  });

  it('counts messages of others after the last visit as new until they are seen', () => {
    const store = TestBed.inject(BoardStore);
    expect(store.live().some((post) => store.isNew(post))).toBe(true);
    store.markSeen();
    expect(store.live().some((post) => store.isNew(post))).toBe(false);
  });
});

describe('titleOf', () => {
  it('takes the first line of text as the heading', () => {
    expect(
      titleOf({ html: '<div style="font-size:20px"><b>Hallo Welt</b></div>Text darunter' }),
    ).toBe('Hallo Welt');
    expect(titleOf({ html: '' })).toBe('');
  });
});
