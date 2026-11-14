import React, { useState } from 'react';
import { Lock, Pencil, Plus, Shield, Users } from 'lucide-react';
import { MAX_PROFILES_PER_ACCOUNT } from '../../shared/profileUtils';
import type { StreamProfile } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { resolveProfileAvatarUrl } from '../data/avatarPresets';
import { ProfileEditorModal, ProfilePinModal } from './ProfileModals';

export function ProfileStrip() {
  const { profiles, activeProfile, selectProfile, verifyProfileAccess } = useAuth();
  const [manageMode, setManageMode] = useState(false);
  const [pinTarget, setPinTarget] = useState<{
    profile: StreamProfile;
    intent: 'switch' | 'edit';
  } | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    editing: StreamProfile | null;
    verifiedPin?: string;
  }>({ open: false, editing: null });

  const handleProfileClick = async (prof: StreamProfile) => {
    if (manageMode) {
      if (prof.hasPin) {
        setPinTarget({ profile: prof, intent: 'edit' });
      } else {
        setEditorState({ open: true, editing: prof });
      }
      return;
    }

    if (prof.id === activeProfile?.id) {
      return;
    }

    const res = await selectProfile(prof.id);
    if (res.requiresPin) {
      setPinTarget({ profile: prof, intent: 'switch' });
    }
  };

  const openEditForProfile = (prof: StreamProfile) => {
    if (prof.hasPin) {
      setPinTarget({ profile: prof, intent: 'edit' });
    } else {
      setEditorState({ open: true, editing: prof });
    }
  };

  return (
    <>
      <section
        aria-label="Perfis de visualização"
        className="ms-glass rounded-2xl px-4 py-3.5 border space-y-3"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
              Perfis
            </h2>
            {activeProfile && (
              <span className="text-xs text-slate-400 truncate">
                · Ativo: <strong className="text-sky-300">{activeProfile.name}</strong>
                {activeProfile.isKids ? ' (Infantil)' : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeProfile && (
              <button
                type="button"
                onClick={() => openEditForProfile(activeProfile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-medium text-slate-200 whitespace-nowrap cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                Configurar ativo
              </button>
            )}
            <button
              type="button"
              onClick={() => setManageMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                manageMode ? 'text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200'
              }`}
              style={manageMode ? { backgroundColor: 'var(--ms-accent)' } : undefined}
            >
              {manageMode ? 'Concluir' : 'Gerenciar'}
            </button>
            {profiles.length < MAX_PROFILES_PER_ACCOUNT && (
              <button
                type="button"
                onClick={() => setEditorState({ open: true, editing: null })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Novo Perfil
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto ms-scrollbar-hide pb-0.5">
          {profiles.map((prof) => {
            const isActive = prof.id === activeProfile?.id;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => void handleProfileClick(prof)}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all shrink-0 cursor-pointer min-h-[48px] ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-400/70 ring-1 ring-sky-400/50'
                    : 'bg-black/30 border-white/10 hover:bg-white/10 hover:border-sky-400/40'
                }`}
              >
                <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/15 shrink-0">
                  <img
                    src={resolveProfileAvatarUrl(prof.avatarId, prof.avatarUrl)}
                    alt={prof.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {manageMode && (
                    <span className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <Pencil className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </div>

                <div className="text-left min-w-0 max-w-[120px]">
                  <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                    {prof.name}
                    {prof.hasPin && (
                      <Lock className="w-3 h-3 text-sky-300 shrink-0" aria-label="Com senha" />
                    )}
                    {prof.isKids && (
                      <Shield className="w-3 h-3 text-emerald-300 shrink-0" aria-label="Infantil" />
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {manageMode ? 'Editar perfil' : isActive ? 'Em uso' : 'Trocar'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <ProfilePinModal
        targetProfile={pinTarget?.profile ?? null}
        actionLabel={pinTarget?.intent === 'edit' ? 'Editar Perfil' : 'Entrar no Perfil'}
        onClose={() => setPinTarget(null)}
        onVerified={async (pin) => {
          if (!pinTarget) return false;
          if (pinTarget.intent === 'switch') {
            const res = await selectProfile(pinTarget.profile.id, pin);
            if (res.ok) {
              setPinTarget(null);
              return true;
            }
            return false;
          }
          const ok = await verifyProfileAccess(pinTarget.profile.id, pin);
          if (ok) {
            const target = pinTarget.profile;
            setPinTarget(null);
            setEditorState({ open: true, editing: target, verifiedPin: pin });
            return true;
          }
          return false;
        }}
      />

      <ProfileEditorModal
        open={editorState.open}
        editingProfile={editorState.editing}
        verifiedCurrentPin={editorState.verifiedPin}
        canDelete={profiles.length > 1}
        onClose={() => setEditorState({ open: false, editing: null })}
      />
    </>
  );
}
