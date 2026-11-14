import React, { useState } from 'react';
import { Lock, LogOut, Pencil, Plus, Trash2 } from 'lucide-react';
import { MAX_PROFILES_PER_ACCOUNT } from '../../shared/profileUtils';
import type { StreamProfile } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { resolveProfileAvatarUrl } from '../data/avatarPresets';
import { Logo } from './Logo';
import {
  ProfileDeleteConfirmModal,
  ProfileEditorModal,
  ProfilePinModal,
} from './ProfileModals';

export function ProfileGateScreen() {
  const { profiles, selectProfile, verifyProfileAccess, logout } = useAuth();
  const [manageMode, setManageMode] = useState(false);
  const [pinTarget, setPinTarget] = useState<{
    profile: StreamProfile;
    intent: 'switch' | 'edit' | 'delete';
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    profile: StreamProfile;
    verifiedPin?: string;
  } | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    editing: StreamProfile | null;
    verifiedPin?: string;
  }>({ open: false, editing: null });

  const handleTileClick = async (prof: StreamProfile) => {
    if (manageMode) {
      if (prof.hasPin) {
        setPinTarget({ profile: prof, intent: 'edit' });
      } else {
        setEditorState({ open: true, editing: prof });
      }
      return;
    }

    const res = await selectProfile(prof.id);
    if (res.requiresPin) {
      setPinTarget({ profile: prof, intent: 'switch' });
    }
  };

  const handleQuickDelete = (prof: StreamProfile) => {
    if (profiles.length <= 1) return;
    if (prof.hasPin) {
      setPinTarget({ profile: prof, intent: 'delete' });
    } else {
      setDeleteTarget({ profile: prof });
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden text-slate-100"
      style={{
        backgroundColor: '#050814',
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(29, 99, 255, 0.16), transparent 62%)',
      }}
    >
      {/* Minimal Netflix-style Top Bar: Brand + Sign out */}
      <header className="px-5 sm:px-10 py-5 flex items-center justify-between gap-4">
        <Logo />
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sair da conta
        </button>
      </header>

      {/* Centered Profiles Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 sm:py-12 max-w-5xl w-full mx-auto">
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-white text-center tracking-tight mb-8 sm:mb-12">
          {manageMode ? 'Gerenciar Perfis' : 'Quem está assistindo?'}
        </h1>

        <div
          role="region"
          aria-label="Seleção de perfis"
          className="flex flex-wrap items-start justify-center gap-5 sm:gap-8 w-full"
        >
          {profiles.map((prof) => (
            <div key={prof.id} className="relative flex flex-col items-center w-28 sm:w-36">
              <button
                type="button"
                onClick={() => void handleTileClick(prof)}
                className="group w-full flex flex-col items-center focus:outline-none cursor-pointer"
              >
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-white group-focus-visible:border-sky-400 group-hover:scale-105 transition-all duration-200 bg-slate-900 shadow-2xl">
                  <img
                    src={resolveProfileAvatarUrl(prof.avatarId, prof.avatarUrl)}
                    alt={prof.name}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-opacity ${
                      manageMode ? 'opacity-50' : 'opacity-100'
                    }`}
                  />

                  {manageMode && (
                    <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full border-2 border-white flex items-center justify-center bg-black/50">
                        <Pencil className="w-5 h-5 text-white" aria-hidden="true" />
                      </span>
                    </span>
                  )}

                  {prof.hasPin && (
                    <span
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-black/75 border border-white/20 flex items-center justify-center text-sky-300"
                      title="Perfil protegido por senha"
                    >
                      <Lock className="w-3.5 h-3.5" aria-label="Com senha" />
                    </span>
                  )}
                </div>

                <span className="mt-3 text-sm sm:text-base font-medium text-slate-300 group-hover:text-white transition-colors truncate max-w-full text-center">
                  {prof.name}
                </span>

                {prof.isKids && (
                  <span className="mt-0.5 text-xs text-sky-400 font-medium">
                    Infantil
                  </span>
                )}
              </button>

              {manageMode && profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleQuickDelete(prof)}
                  aria-label={`Excluir perfil ${prof.name}`}
                  title={`Excluir perfil ${prof.name}`}
                  className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 border-2 border-[#050814] text-white flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          {profiles.length < MAX_PROFILES_PER_ACCOUNT && (
            <button
              type="button"
              onClick={() => setEditorState({ open: true, editing: null })}
              className="group flex flex-col items-center w-28 sm:w-36 focus:outline-none cursor-pointer"
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.04] group-hover:bg-white/[0.1] group-hover:border-white group-focus-visible:border-sky-400 group-hover:scale-105 transition-all duration-200 flex items-center justify-center">
                <Plus
                  className="w-11 h-11 text-slate-400 group-hover:text-white transition-colors"
                  aria-hidden="true"
                />
              </div>
              <span className="mt-3 text-sm sm:text-base font-medium text-slate-400 group-hover:text-white transition-colors text-center">
                Adicionar Perfil
              </span>
            </button>
          )}
        </div>

        <div className="mt-10 sm:mt-14">
          <button
            type="button"
            onClick={() => setManageMode((v) => !v)}
            className={`px-7 py-2.5 min-h-[44px] border text-sm font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
              manageMode
                ? 'bg-white text-slate-950 border-white font-semibold hover:bg-slate-200'
                : 'border-slate-500 text-slate-300 hover:border-white hover:text-white'
            }`}
          >
            {manageMode ? 'Concluir' : 'Gerenciar Perfis'}
          </button>
        </div>
      </main>

      <ProfilePinModal
        targetProfile={pinTarget?.profile ?? null}
        actionLabel={
          pinTarget?.intent === 'delete'
            ? 'Confirmar Exclusão'
            : pinTarget?.intent === 'edit'
              ? 'Editar Perfil'
              : 'Entrar no Perfil'
        }
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
            const intent = pinTarget.intent;
            setPinTarget(null);
            if (intent === 'delete') {
              setDeleteTarget({ profile: target, verifiedPin: pin });
            } else {
              setEditorState({ open: true, editing: target, verifiedPin: pin });
            }
            return true;
          }
          return false;
        }}
      />

      <ProfileDeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      <ProfileEditorModal
        open={editorState.open}
        editingProfile={editorState.editing}
        verifiedCurrentPin={editorState.verifiedPin}
        canDelete={profiles.length > 1}
        onClose={() => setEditorState({ open: false, editing: null })}
      />
    </div>
  );
}
