import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts in auto mode without a theme attribute', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('cycles auto, light, dark and back', () => {
    const service = TestBed.inject(ThemeService);
    service.cycle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    service.cycle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('themeMode')).toBe('dark');
    service.cycle();
    expect(service.mode()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
