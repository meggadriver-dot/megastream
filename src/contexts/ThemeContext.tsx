import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeId } from '../../shared/types';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  subtitle: string;
  previewGradient: string;
  accentHex: string;
}

export const MEGASTREAM_THEMES: ThemeMeta[] = [
  {
    id: 'cinematografico',
    name: 'Cinematográfico',
    subtitle: 'Imersão total em azul elétrico e preto profundo',
    previewGradient: 'from-[#050814] via-[#0c235a] to-[#00d4ff]',
    accentHex: '1d63ff',
  },
  {
    id: 'neon-roxo',
    name: 'Neon Roxo',
    subtitle: 'Moderno e arrojado com violeta luminoso',
    previewGradient: 'from-[#070414] via-[#3b0764] to-[#d946ef]',
    accentHex: '8b5cf6',
  },
  {
    id: 'minimalista',
    name: 'Minimalista',
    subtitle: 'Elegante e limpo em alto contraste monocromático',
    previewGradient: 'from-[#09090b] via-[#27272a] to-[#fafafa]',
    accentHex: 'e4e4e7',
  },
  {
    id: 'gold-premium',
    name: 'Gold Premium',
    subtitle: 'Luxo e sofisticação em obsidiana e dourado',
    previewGradient: 'from-[#0a0804] via-[#451a03] to-[#fbbf24]',
    accentHex: 'd97706',
  },
  {
    id: '3d-glass',
    name: '3D Glass',
    subtitle: 'Futurista translúcido com brilho cristalino',
    previewGradient: 'from-[#030b18] via-[#075985] to-[#38bdf8]',
    accentHex: '0284c7',
  },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = 'megastream_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && MEGASTREAM_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
    return 'cinematografico';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: ThemeId) => {
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: MEGASTREAM_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
