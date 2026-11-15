import React from 'react';
import { Lock } from 'lucide-react';
import type { PlanId, SystemSettings } from '../../../shared/types';

interface AdminPoliciesPanelProps {
  systemSettings: SystemSettings;
  onChange: (next: SystemSettings) => void;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
}

export function AdminPoliciesPanel({
  systemSettings,
  onChange,
  saving,
  onSave,
}: AdminPoliciesPanelProps) {
  return (
    <form
      onSubmit={onSave}
      className="rounded-2xl bg-[#0c1224] border border-white/10 p-6 space-y-5"
    >
      <div>
        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-sky-400" />
          Políticas de Acesso, Cadastro & Limite de Perfis
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Regras aplicadas em tempo real ao fluxo de login, cadastro, reprodução e criação de perfis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="rounded-xl bg-black/30 border border-white/10 p-4 flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-white">Permitir Novos Cadastros</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Habilita ou bloqueia a criação de novas contas na página de registro.
            </p>
          </div>
          <input
            type="checkbox"
            checked={systemSettings.allowRegistration}
            onChange={(e) => onChange({ ...systemSettings, allowRegistration: e.target.checked })}
            className="w-4 h-4 mt-0.5 accent-sky-500 shrink-0"
          />
        </label>

        <label className="rounded-xl bg-black/30 border border-white/10 p-4 flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-white">Exigir Login no Player</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quando ativo, exige usuário autenticado para reproduzir filmes ou séries.
            </p>
          </div>
          <input
            type="checkbox"
            checked={systemSettings.requireAuthForPlayer}
            onChange={(e) =>
              onChange({ ...systemSettings, requireAuthForPlayer: e.target.checked })
            }
            className="w-4 h-4 mt-0.5 accent-sky-500 shrink-0"
          />
        </label>

        <label className="rounded-xl bg-black/30 border border-white/10 p-4 flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-white">Favoritos para Visitantes</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Permite salvar favoritos localmente antes de fazer login na conta.
            </p>
          </div>
          <input
            type="checkbox"
            checked={systemSettings.allowGuestFavorites}
            onChange={(e) =>
              onChange({ ...systemSettings, allowGuestFavorites: e.target.checked })
            }
            className="w-4 h-4 mt-0.5 accent-sky-500 shrink-0"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pol-max-profiles" className="block text-xs text-slate-300 mb-1">
            Limite de Perfis por Conta (1 a 8)
          </label>
          <input
            id="pol-max-profiles"
            type="number"
            min={1}
            max={8}
            value={systemSettings.maxProfilesPerAccount}
            onChange={(e) =>
              onChange({
                ...systemSettings,
                maxProfilesPerAccount: Math.max(1, Math.min(8, Number(e.target.value) || 5)),
              })
            }
            className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-mono-tabular"
          />
        </div>

        <div>
          <label htmlFor="pol-default-plan" className="block text-xs text-slate-300 mb-1">
            Plano Inicial para Novas Contas
          </label>
          <select
            id="pol-default-plan"
            value={systemSettings.defaultUserPlan}
            onChange={(e) =>
              onChange({ ...systemSettings, defaultUserPlan: e.target.value as PlanId })
            }
            className="w-full h-10 px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
          >
            <option value="free">Gratuito (Free)</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--ms-accent)' }}
        >
          {saving ? 'Salvando...' : 'Salvar Políticas de Acesso'}
        </button>
      </div>
    </form>
  );
}
