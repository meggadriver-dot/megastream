import React, { useState } from 'react';
import { Bell, Check, Globe, Lock, Palette, Shield, Sliders } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeId } from '../../shared/types';

export function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();
  const { profile, firebaseUser, updatePreferences } = useAuth();

  const [language, setLanguage] = useState(profile?.preferredLanguage || 'pt-BR');
  const [quality, setQuality] = useState(profile?.preferredQuality || '1080p');
  const [notifications, setNotifications] = useState(profile?.notificationsEnabled ?? true);
  const [parentalControl, setParentalControl] = useState(profile?.parentalControl ?? false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleThemeSelect = async (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    if (firebaseUser) {
      await updatePreferences({ preferredTheme: nextTheme });
    }
    setSavedNotice('Tema visual aplicado.');
    setTimeout(() => setSavedNotice(null), 2000);
  };

  const handleSavePrefs = async () => {
    if (firebaseUser) {
      await updatePreferences({
        preferredLanguage: language,
        preferredQuality: quality,
        notificationsEnabled: notifications,
        parentalControl,
        preferredTheme: theme,
      });
    } else {
      localStorage.setItem(
        'megastream_prefs',
        JSON.stringify({ language, quality, notifications, parentalControl })
      );
    }
    setSavedNotice('Preferências salvas com sucesso.');
    setTimeout(() => setSavedNotice(null), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Configurações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalize o tema visual, preferências de reprodução, privacidade e segurança.
          </p>
        </div>
        {savedNotice && (
          <span role="status" className="text-xs font-semibold text-emerald-300">
            {savedNotice}
          </span>
        )}
      </div>

      {/* 5 Exclusive Visual Themes */}
      <section className="ms-glass rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-sky-400" />
          <h2 className="font-display text-lg font-bold text-white">
            Aparência e Temas Exclusivos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {themes.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleThemeSelect(t.id)}
                className={`text-left rounded-2xl p-3 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  active ? 'ring-2 ring-sky-400 bg-white/10' : 'bg-black/30 hover:bg-white/5'
                }`}
                style={{ borderColor: 'var(--ms-border)' }}
              >
                <div className={`h-16 w-full rounded-xl bg-gradient-to-br ${t.previewGradient} relative`}>
                  {active && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{t.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Playback, Language, Parental Control */}
      <section className="ms-glass rounded-3xl p-6 space-y-5">
        <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-sky-400" />
          Reprodução e Idioma
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pref-lang" className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
              <Globe className="w-4 h-4 text-sky-400" />
              Idioma da Interface e Catálogo
            </label>
            <select
              id="pref-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
              style={{ borderColor: 'var(--ms-border)' }}
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-quality" className="block text-xs font-medium text-slate-300 mb-1.5">
              Qualidade Preferencial
            </label>
            <select
              id="pref-quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-black/40 border text-sm text-white"
              style={{ borderColor: 'var(--ms-border)' }}
            >
              <option value="auto">Automática (Adaptativa)</option>
              <option value="1080p">Full HD (1080p)</option>
              <option value="720p">HD (720p)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--ms-border)' }}>
          <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
            <span className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-sky-400" />
              <span>
                <span className="block text-sm font-semibold text-white">Notificações de Lançamentos</span>
                <span className="block text-xs text-slate-400">Receber avisos de novos episódios e filmes populares</span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="w-5 h-5 accent-sky-500"
            />
          </label>

          <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
            <span className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-sky-400" />
              <span>
                <span className="block text-sm font-semibold text-white">Controle Parental</span>
                <span className="block text-xs text-slate-400">Ocultar títulos adultos ou com classificação restrita nas buscas</span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={parentalControl}
              onChange={(e) => setParentalControl(e.target.checked)}
              className="w-5 h-5 accent-sky-500"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSavePrefs}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Salvar Preferências
          </button>
        </div>
      </section>

      {/* Privacy & Security */}
      <section className="ms-glass rounded-3xl p-6 space-y-2">
        <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-sky-400" />
          Privacidade e Segurança
        </h2>
        <p className="text-sm text-slate-300">
          Sua sessão é protegida pelo Firebase Authentication com tokens verificados no servidor. Chaves privadas de APIs externas (TMDB e Gemini) permanecem isoladas exclusivamente no ambiente do servidor.
        </p>
      </section>
    </div>
  );
}
