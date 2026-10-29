import { TestBed } from '@angular/core/testing';
import { BoardStore } from './board.store';

describe('BoardStore', () => {
  it('shows important messages first and keeps expired ones in the archive', () => {
    const store = TestBed.inject(BoardStore);
    expect(store.live()[0].important).toBe(true);
    expect(store.live().every((post) => !store.expired(post))).toBe(true);
    expect(store.archive().length).toBeGreaterThan(0);
  });

  it('saves a new message and removes it again', () => {
    const store = TestBed.inject(BoardStore);
    const post = { ...store.newPost(), title: 'Test' };
    store.save(post);
    expect(store.live().some((item) => item.id === post.id)).toBe(true);
    store.remove(post.id);
    expect(store.posts().some((item) => item.id === post.id)).toBe(false);
  });

  it('moves a message but never across the important border', () => {
    const store = TestBed.inject(BoardStore);
    const normal = store.live().filter((post) => !post.important);
    store.move(normal[0].id, 1);
    expect(store.live().filter((post) => !post.important)[1].id).toBe(normal[0].id);
    const important = store.live().find((post) => post.important)!;
    const before = store.live().map((post) => post.id);
    store.move(important.id, 1);
    expect(store.live().map((post) => post.id)).toEqual(before);
  });
});
