import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

type ThemeStore = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'light',
  setMode: (mode) => set({ mode }),
  toggle: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
}));

export const useThemeMode = () => useThemeStore((state) => state.mode);
export const useToggleTheme = () => useThemeStore((state) => state.toggle);
