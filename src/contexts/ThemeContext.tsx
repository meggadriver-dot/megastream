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
  setTheme: (next: ThemeId, isExplicitUserChoice?: boolean) => void;
  setThemeIfUnset: (next: ThemeId) => void;
  applySiteDefaultTheme: (next: ThemeId, configVersion?: string, forceAdminOverride?: boolean) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = 'megastream_theme';
const THEME_EXPLICIT_KEY = 'megastream_user_theme_explicit';
const SITE_THEME_VERSION_KEY = 'megastream_site_theme_version';

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
  }, [theme]);

  const setTheme = (next: ThemeId, isExplicitUserChoice = true) => {
    if (!MEGASTREAM_THEMES.some((t) => t.id === next)) return;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    if (isExplicitUserChoice) {
      localStorage.setItem(THEME_EXPLICIT_KEY, '1');
    }
    setThemeState(next);
  };

  const setThemeIfUnset = (next: ThemeId) => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (!saved && MEGASTREAM_THEMES.some((t) => t.id === next)) {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      setThemeState(next);
    }
  };

  const applySiteDefaultTheme = (
    next: ThemeId,
    configVersion?: string,
    forceAdminOverride = false
  ) => {
    if (!MEGASTREAM_THEMES.some((t) => t.id === next)) return;
    const prevVersion = localStorage.getItem(SITE_THEME_VERSION_KEY);
    const hasNewAdminVersion = Boolean(configVersion && configVersion !== prevVersion);
    const isUserExplicit = localStorage.getItem(THEME_EXPLICIT_KEY) === '1';

    if (forceAdminOverride || hasNewAdminVersion || !isUserExplicit) {
      if (configVersion) {
        localStorage.setItem(SITE_THEME_VERSION_KEY, configVersion);
      }
      if (forceAdminOverride || hasNewAdminVersion) {
        localStorage.removeItem(THEME_EXPLICIT_KEY);
      }
      localStorage.setItem(THEME_STORAGE_KEY, next);
      setThemeState(next);
    }
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, setThemeIfUnset, applySiteDefaultTheme, themes: MEGASTREAM_THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
