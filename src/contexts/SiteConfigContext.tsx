import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { DEFAULT_SITE_CONFIG, sanitizeSiteConfig } from '../../shared/siteConfigUtils';
import type { SiteConfig } from '../../shared/types';
import { db } from '../lib/firebase';
import { apiRequest } from '../services/apiClient';
import { useTheme } from './ThemeContext';

interface SiteConfigContextValue {
  siteConfig: SiteConfig;
  loadingConfig: boolean;
  refreshSiteConfig: () => Promise<void>;
  applySiteConfig: (next: SiteConfig) => void;
}

const SiteConfigContext = createContext<SiteConfigContextValue | undefined>(undefined);

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0, 168, 255, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const { setThemeIfUnset } = useTheme();

  const syncVisualVariables = useCallback(
    (cfg: SiteConfig) => {
      document.title = `${cfg.siteName} — ${cfg.siteSlogan}`;
      setThemeIfUnset(cfg.defaultTheme);

      const root = document.documentElement;
      if (cfg.accentColorHex && cfg.accentColorHex.length === 6) {
        root.style.setProperty('--ms-accent', `#${cfg.accentColorHex}`);
        root.style.setProperty('--ms-accent-bright', `#${cfg.accentColorHex}`);
        root.style.setProperty('--ms-accent-glow', hexToRgba(cfg.accentColorHex, 0.36));
      } else {
        root.style.removeProperty('--ms-accent');
        root.style.removeProperty('--ms-accent-bright');
        root.style.removeProperty('--ms-accent-glow');
      }
    },
    [setThemeIfUnset]
  );

  const applySiteConfig = useCallback(
    (next: SiteConfig) => {
      setSiteConfig(next);
      syncVisualVariables(next);
    },
    [syncVisualVariables]
  );

  const refreshSiteConfig = useCallback(async () => {
    try {
      const apiCfg = await apiRequest<SiteConfig>('/api/site-config');
      const normalized = sanitizeSiteConfig(apiCfg, DEFAULT_SITE_CONFIG);
      applySiteConfig(normalized);
    } catch {
      try {
        const snap = await getDoc(doc(db, 'siteConfig', 'global'));
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteConfig>;
          applySiteConfig(sanitizeSiteConfig(data, DEFAULT_SITE_CONFIG));
        }
      } catch {
        // Keep defaults on offline/startup fallback
      }
    } finally {
      setLoadingConfig(false);
    }
  }, [applySiteConfig]);

  useEffect(() => {
    void refreshSiteConfig();
  }, [refreshSiteConfig]);

  return (
    <SiteConfigContext.Provider
      value={{ siteConfig, loadingConfig, refreshSiteConfig, applySiteConfig }}
    >
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error('useSiteConfig deve ser usado dentro de SiteConfigProvider');
  return ctx;
}
