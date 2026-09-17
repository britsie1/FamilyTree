import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { useThemeStore } from '../src/stores/useThemeStore.ts';

// In-memory mock for localStorage in node test environment
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// Minimal DOM mock for classList on document.documentElement
class MockClassList {
  private classes = new Set<string>();
  add(...tokens: string[]): void {
    for (const t of tokens) this.classes.add(t);
  }
  remove(...tokens: string[]): void {
    for (const t of tokens) this.classes.delete(t);
  }
  contains(token: string): boolean {
    return this.classes.has(token);
  }
  toggle(token: string, force?: boolean): boolean {
    if (force !== undefined) {
      if (force) this.classes.add(token);
      else this.classes.delete(token);
      return force;
    }
    if (this.classes.has(token)) {
      this.classes.delete(token);
      return false;
    } else {
      this.classes.add(token);
      return true;
    }
  }
}

describe('useThemeStore', () => {
  let mockClassList: MockClassList;

  beforeEach(() => {
    // Setup mock localStorage
    // @ts-ignore
    globalThis.localStorage = new MemoryStorage();

    // Setup mock document
    mockClassList = new MockClassList();
    // @ts-ignore
    globalThis.document = {
      documentElement: {
        classList: mockClassList,
      },
    };

    // Setup mock window with matchMedia
    // @ts-ignore
    globalThis.window = {
      matchMedia: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    };

    // Reset store to light mode
    useThemeStore.getState().setTheme('light');
  });

  it('initializes with light theme by default when set', () => {
    const state = useThemeStore.getState();
    assert.strictEqual(state.theme, 'light');
    assert.strictEqual(state.isDark, false);
    assert.strictEqual(mockClassList.contains('dark'), false);
  });

  it('switches to dark theme via setTheme("dark")', () => {
    useThemeStore.getState().setTheme('dark');
    const state = useThemeStore.getState();

    assert.strictEqual(state.theme, 'dark');
    assert.strictEqual(state.isDark, true);
    assert.strictEqual(mockClassList.contains('dark'), true);
    assert.strictEqual(globalThis.localStorage.getItem('familytree_theme'), 'dark');
  });

  it('switches back to light theme via setTheme("light")', () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().setTheme('light');
    const state = useThemeStore.getState();

    assert.strictEqual(state.theme, 'light');
    assert.strictEqual(state.isDark, false);
    assert.strictEqual(mockClassList.contains('dark'), false);
    assert.strictEqual(globalThis.localStorage.getItem('familytree_theme'), 'light');
  });

  it('toggles theme between light and dark via toggleTheme()', () => {
    useThemeStore.getState().setTheme('light');
    assert.strictEqual(useThemeStore.getState().isDark, false);

    // Toggle 1: light -> dark
    useThemeStore.getState().toggleTheme();
    assert.strictEqual(useThemeStore.getState().theme, 'dark');
    assert.strictEqual(useThemeStore.getState().isDark, true);
    assert.strictEqual(mockClassList.contains('dark'), true);
    assert.strictEqual(globalThis.localStorage.getItem('familytree_theme'), 'dark');

    // Toggle 2: dark -> light
    useThemeStore.getState().toggleTheme();
    assert.strictEqual(useThemeStore.getState().theme, 'light');
    assert.strictEqual(useThemeStore.getState().isDark, false);
    assert.strictEqual(mockClassList.contains('dark'), false);
    assert.strictEqual(globalThis.localStorage.getItem('familytree_theme'), 'light');
  });

  it('handles system preference when set to "system"', () => {
    // Mock system preference as dark
    // @ts-ignore
    globalThis.window.matchMedia = (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    useThemeStore.getState().setTheme('system');
    const state = useThemeStore.getState();

    assert.strictEqual(state.theme, 'system');
    assert.strictEqual(state.isDark, true);
    assert.strictEqual(mockClassList.contains('dark'), true);
    assert.strictEqual(globalThis.localStorage.getItem('familytree_theme'), 'system');
  });
});
