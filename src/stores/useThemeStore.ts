import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeStoreState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'familytree_theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (err) {
    console.warn('Failed to read theme from localStorage:', err);
  }
  return 'system';
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'system') {
    return getSystemTheme() === 'dark';
  }
  return theme === 'dark';
}

function applyThemeToDocument(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

const initialTheme = getInitialTheme();
const initialIsDark = resolveIsDark(initialTheme);
applyThemeToDocument(initialIsDark);

export const useThemeStore = create<ThemeStoreState>((set, get) => {
  // Listen to system color scheme changes if theme is 'system'
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const { theme } = get();
      if (theme === 'system') {
        const isDark = mediaQuery.matches;
        applyThemeToDocument(isDark);
        set({ isDark });
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
  }

  return {
    theme: initialTheme,
    isDark: initialIsDark,

    setTheme: (theme: Theme) => {
      const isDark = resolveIsDark(theme);
      applyThemeToDocument(isDark);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (err) {
        console.warn('Failed to save theme to localStorage:', err);
      }
      set({ theme, isDark });
    },

    toggleTheme: () => {
      const currentIsDark = get().isDark;
      const nextTheme: Theme = currentIsDark ? 'light' : 'dark';
      get().setTheme(nextTheme);
    },
  };
});
