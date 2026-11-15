import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_SITE_CONFIG, sanitizeSiteConfig } from '../../shared/siteConfigUtils';
import {
  DEFAULT_SYSTEM_SETTINGS,
  extractPublicRuntimeSettings,
  sanitizeSystemSettings,
} from '../../shared/systemSettingsUtils';
import type { PublicRuntimeSettings, SiteConfig, SystemSettings } from '../../shared/types';
import { db } from '../lib/firebase';
import { apiRequest } from '../services/apiClient';
import { useTheme } from './ThemeContext';

const DEFAULT_PUBLIC_RUNTIME = extractPublicRuntimeSettings(DEFAULT_SYSTEM_SETTINGS, 12);

interface SiteConfigContextValue {
  siteConfig: SiteConfig;
  runtimeSettings: PublicRuntimeSettings;
  loadingConfig: boolean;
  refreshSiteConfig: () => Promise<void>;
  applySiteConfig: (next: SiteConfig, fromAdminSave?: boolean) => void;
  applyRuntimeSettings: (next: PublicRuntimeSettings, fromAdminSave?: boolean) => void;
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
  const [runtimeSettings, setRuntimeSettings] =
    useState<PublicRuntimeSettings>(DEFAULT_PUBLIC_RUNTIME);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const latestUpdatedAtRef = useRef<number>(Date.parse(DEFAULT_SITE_CONFIG.updatedAt) || 0);
  const latestRuntimeUpdatedAtRef = useRef<number>(
    Date.parse(DEFAULT_SYSTEM_SETTINGS.updatedAt) || 0
  );
  const { applySiteDefaultTheme } = useTheme();

  const syncVisualVariables = useCallback(
    (cfg: SiteConfig, fromAdminSave = false) => {
      document.title = `${cfg.siteName} — ${cfg.siteSlogan}`;
      applySiteDefaultTheme(cfg.defaultTheme, cfg.updatedAt, fromAdminSave);

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
    [applySiteDefaultTheme]
  );

  const applySiteConfig = useCallback(
    (next: SiteConfig, fromAdminSave = false) => {
      const ts = Date.parse(next.updatedAt || '') || 0;
      if (!fromAdminSave && ts > 0 && ts < latestUpdatedAtRef.current) {
        return;
      }
      if (ts > latestUpdatedAtRef.current) {
        latestUpdatedAtRef.current = ts;
      }
      setSiteConfig(next);
      syncVisualVariables(next, fromAdminSave);
    },
    [syncVisualVariables]
  );

  const applyRuntimeSettings = useCallback(
    (next: PublicRuntimeSettings, fromAdminSave = false) => {
      const ts = Date.parse(next.updatedAt || '') || 0;
      if (!fromAdminSave && ts > 0 && ts < latestRuntimeUpdatedAtRef.current) {
        return;
      }
      if (ts > latestRuntimeUpdatedAtRef.current) {
        latestRuntimeUpdatedAtRef.current = ts;
      }
      setRuntimeSettings(next);
    },
    []
  );

  const refreshSiteConfig = useCallback(async () => {
    try {
      const [fsResult, apiResult, fsSysResult, apiSysResult] = await Promise.allSettled([
        getDoc(doc(db, 'siteConfig', 'global')),
        apiRequest<SiteConfig>('/api/site-config'),
        getDoc(doc(db, 'systemSettings', 'global')),
        apiRequest<PublicRuntimeSettings>('/api/system-config'),
      ]);

      let chosen: SiteConfig | null = null;
      let chosenTs = 0;

      if (fsResult.status === 'fulfilled' && fsResult.value.exists()) {
        const fsCfg = sanitizeSiteConfig(
          fsResult.value.data() as Partial<SiteConfig>,
          DEFAULT_SITE_CONFIG,
          true
        );
        const ts = Date.parse(fsCfg.updatedAt) || 0;
        chosen = fsCfg;
        chosenTs = ts;
      }

      if (apiResult.status === 'fulfilled' && apiResult.value) {
        const apiCfg = sanitizeSiteConfig(apiResult.value, DEFAULT_SITE_CONFIG, true);
        const ts = Date.parse(apiCfg.updatedAt) || 0;
        if (!chosen || (ts > chosenTs && apiCfg.updatedAt !== DEFAULT_SITE_CONFIG.updatedAt)) {
          chosen = apiCfg;
        }
      }

      if (chosen) {
        applySiteConfig(chosen);
      }

      let chosenRuntime: PublicRuntimeSettings | null = null;
      let chosenRuntimeTs = 0;

      if (fsSysResult.status === 'fulfilled' && fsSysResult.value.exists()) {
        const sanitizedSys = sanitizeSystemSettings(
          fsSysResult.value.data() as Partial<SystemSettings>,
          DEFAULT_SYSTEM_SETTINGS,
          true
        );
        chosenRuntime = extractPublicRuntimeSettings(sanitizedSys);
        chosenRuntimeTs = Date.parse(chosenRuntime.updatedAt) || 0;
      }

      if (apiSysResult.status === 'fulfilled' && apiSysResult.value) {
        const apiRt = apiSysResult.value;
        const ts = Date.parse(apiRt.updatedAt || '') || 0;
        if (
          !chosenRuntime ||
          (ts >= chosenRuntimeTs && apiRt.updatedAt !== DEFAULT_SYSTEM_SETTINGS.updatedAt)
        ) {
          chosenRuntime = apiRt;
        }
      }

      if (chosenRuntime) {
        applyRuntimeSettings(chosenRuntime);
      }
    } finally {
      setLoadingConfig(false);
    }
  }, [applyRuntimeSettings, applySiteConfig]);

  useEffect(() => {
    void refreshSiteConfig();

    const unsubSite = onSnapshot(
      doc(db, 'siteConfig', 'global'),
      (snap) => {
        if (snap.exists()) {
          const fsCfg = sanitizeSiteConfig(
            snap.data() as Partial<SiteConfig>,
            DEFAULT_SITE_CONFIG,
            true
          );
          applySiteConfig(fsCfg);
        }
        setLoadingConfig(false);
      },
      () => {
        setLoadingConfig(false);
      }
    );

    const unsubSystem = onSnapshot(
      doc(db, 'systemSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const sanitizedSys = sanitizeSystemSettings(
            snap.data() as Partial<SystemSettings>,
            DEFAULT_SYSTEM_SETTINGS,
            true
          );
          setRuntimeSettings((prev) => {
            const next = extractPublicRuntimeSettings(sanitizedSys, prev.embedTimeoutSeconds);
            const ts = Date.parse(next.updatedAt || '') || 0;
            if (ts > latestRuntimeUpdatedAtRef.current) {
              latestRuntimeUpdatedAtRef.current = ts;
            }
            return next;
          });
        }
      },
      () => {
        // Ignore read error
      }
    );

    return () => {
      unsubSite();
      unsubSystem();
    };
  }, [applySiteConfig, refreshSiteConfig]);

  return (
    <SiteConfigContext.Provider
      value={{
        siteConfig,
        runtimeSettings,
        loadingConfig,
        refreshSiteConfig,
        applySiteConfig,
        applyRuntimeSettings,
      }}
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
