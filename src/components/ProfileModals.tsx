import React, { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import {
  MAX_PROFILES_PER_ACCOUNT,
  sanitizeAvatarUrl,
  validateProfilePin,
} from '../../shared/profileUtils';
import type { AvatarCategory, StreamProfile, ThemeId } from '../../shared/types';
import { type ProfileFormInput, useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  AVATAR_CATEGORIES,
  CLIENT_AVATAR_PRESETS,
  resolveProfileAvatarUrl,
} from '../data/avatarPresets';

interface ProfilePinModalProps {
  targetProfile: StreamProfile | null;
  actionLabel?: string;
  onClose: () => void;
  onVerified: (pin: string) => Promise<boolean> | boolean;
}

export function ProfilePinModal({
  targetProfile,
  actionLabel = 'Desbloquear Perfil',
  onClose,
  onVerified,
}: ProfilePinModalProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPin('');
    setError(null);
    setShowPin(false);
  }, [targetProfile?.id]);

  if (!targetProfile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfilePin(pin)) {
      setError('Digite uma senha válida (4 a 12 caracteres sem espaços).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onVerified(pin.trim());
      if (!ok) {
        setError('Senha incorreta. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Senha do perfil ${targetProfile.name}`}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        className="w-full max-w-md ms-glass rounded-3xl p-6 sm:p-7 space-y-5 border shadow-2xl"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src={resolveProfileAvatarUrl(targetProfile.avatarId, targetProfile.avatarUrl)}
              alt={targetProfile.name}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-sky-400/60"
            />
            <div>
              <p className="text-xs text-sky-300 font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                Perfil protegido
              </p>
              <h2 className="font-display text-lg font-bold text-white">{targetProfile.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar verificação de senha"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile-pin-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Digite a senha do perfil para continuar
            </label>
            <div className="relative">
              <input
                id="profile-pin-input"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4 a 12 caracteres"
                autoFocus
                maxLength={12}
                className="w-full h-11 pl-4 pr-11 rounded-xl bg-black/45 border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                style={{ borderColor: 'var(--ms-border)' }}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white ms-glow cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              <Unlock className="w-4 h-4" aria-hidden="true" />
              {submitting ? 'Verificando...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProfileEditorModalProps {
  open: boolean;
  editingProfile: StreamProfile | null;
  verifiedCurrentPin?: string;
  canDelete: boolean;
  onClose: () => void;
}

function resizeUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileEditorModal({
  open,
  editingProfile,
  verifiedCurrentPin = '',
  canDelete,
  onClose,
}: ProfileEditorModalProps) {
  const { createProfile, updateProfileItem, deleteProfileItem } = useAuth();
  const { themes } = useTheme();

  const [name, setName] = useState('');
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategory>('todos');
  const [avatarId, setAvatarId] = useState('avatar_cartoon_hero');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [isKids, setIsKids] = useState(false);
  const [preferredTheme, setPreferredTheme] = useState<ThemeId>('cinematografico');
  const [preferredLanguage, setPreferredLanguage] = useState('pt-BR');
  const [preferredQuality, setPreferredQuality] = useState('1080p');
  const [autoplayNext, setAutoplayNext] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    setAvatarCategory('todos');
    setPin('');
    setConfirmPin('');
    setCurrentPin(verifiedCurrentPin);
    setShowPin(false);

    if (editingProfile) {
      setName(editingProfile.name);
      setAvatarId(editingProfile.avatarId || 'avatar_movie_astronaut');
      setCustomAvatarUrl(
        editingProfile.avatarId === 'custom' ? editingProfile.avatarUrl : ''
      );
      setShowCustomUrl(editingProfile.avatarId === 'custom');
      setPinEnabled(editingProfile.hasPin);
      setIsKids(editingProfile.isKids);
      setPreferredTheme(editingProfile.preferredTheme || 'cinematografico');
      setPreferredLanguage(editingProfile.preferredLanguage || 'pt-BR');
      setPreferredQuality(editingProfile.preferredQuality || '1080p');
      setAutoplayNext(editingProfile.autoplayNext);
    } else {
      setName('');
      setAvatarId('avatar_cartoon_hero');
      setCustomAvatarUrl('');
      setShowCustomUrl(false);
      setPinEnabled(false);
      setIsKids(false);
      setPreferredTheme('cinematografico');
      setPreferredLanguage('pt-BR');
      setPreferredQuality('1080p');
      setAutoplayNext(true);
    }
  }, [open, editingProfile, verifiedCurrentPin]);

  if (!open) return null;

  const filteredAvatars =
    avatarCategory === 'todos'
      ? CLIENT_AVATAR_PRESETS
      : CLIENT_AVATAR_PRESETS.filter((a) => a.category === avatarCategory);

  const activePreviewUrl =
    avatarId === 'custom' && customAvatarUrl.trim()
      ? sanitizeAvatarUrl(customAvatarUrl)
      : resolveProfileAvatarUrl(avatarId, customAvatarUrl);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeUploadedImage(file);
      setAvatarId('custom');
      setCustomAvatarUrl(dataUrl);
      setShowCustomUrl(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar foto.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Informe um nome para o perfil.');
      return;
    }

    if (avatarId === 'custom' && !customAvatarUrl.trim()) {
      setError('Escolha uma foto da galeria, envie uma imagem ou informe uma URL válida.');
      return;
    }

    const trimmedPin = pin.trim();
    const trimmedConfirm = confirmPin.trim();
    const editingExistingPin = Boolean(editingProfile?.hasPin);

    if (!editingExistingPin && pinEnabled) {
      if (!validateProfilePin(trimmedPin)) {
        setError('A senha do perfil deve ter entre 4 e 12 caracteres sem espaços.');
        return;
      }
      if (trimmedPin !== trimmedConfirm) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
    }

    if (editingExistingPin && pinEnabled && trimmedPin.length > 0) {
      if (!validateProfilePin(trimmedPin)) {
        setError('A nova senha deve ter entre 4 e 12 caracteres sem espaços.');
        return;
      }
      if (trimmedPin !== trimmedConfirm) {
        setError('A confirmação da nova senha não coincide.');
        return;
      }
    }

    const payload: ProfileFormInput = {
      name: trimmedName,
      avatarId,
      avatarUrl: avatarId === 'custom' ? customAvatarUrl.trim() : undefined,
      isKids,
      preferredTheme,
      preferredLanguage,
      preferredQuality,
      autoplayNext,
      ...(pinEnabled
        ? trimmedPin.length > 0
          ? { pin: trimmedPin, currentPin: currentPin.trim() || undefined }
          : {}
        : editingExistingPin
          ? { removePin: true, currentPin: currentPin.trim() || undefined }
          : {}),
    };

    setSaving(true);
    try {
      if (editingProfile) {
        await updateProfileItem(editingProfile.id, payload);
      } else {
        await createProfile(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProfileItem(editingProfile.id, currentPin.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir perfil.');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editingProfile ? `Configurar perfil ${editingProfile.name}` : 'Criar novo perfil'}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        className="w-full max-w-2xl ms-glass rounded-3xl border shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden"
        style={{ borderColor: 'var(--ms-border)' }}
      >
        {/* Modal Header */}
        <div
          className="px-5 sm:px-6 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--ms-border)' }}
        >
          <div className="flex items-center gap-3">
            <img
              src={activePreviewUrl}
              alt={name || 'Prévia do avatar'}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-sky-400/60"
            />
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {editingProfile ? `Configurar Perfil · ${editingProfile.name}` : 'Criar Novo Perfil'}
              </h2>
              <p className="text-xs text-slate-400">
                Personalize nome, avatar, senha de acesso e preferências
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Avatar Library Section */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Escolha uma foto ou personagem</h3>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border text-xs font-medium text-sky-200 cursor-pointer" style={{ borderColor: 'var(--ms-border)' }}>
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFile}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomUrl((v) => !v);
                    setAvatarId('custom');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border text-xs font-medium text-slate-200 cursor-pointer"
                  style={{ borderColor: 'var(--ms-border)' }}
                >
                  Usar URL
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto ms-scrollbar-hide pb-1" role="tablist" aria-label="Categorias de avatar">
              {AVATAR_CATEGORIES.map((cat) => {
                const active = avatarCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAvatarCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      active ? 'text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                    style={active ? { backgroundColor: 'var(--ms-accent)' } : undefined}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Avatar Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
              {filteredAvatars.map((preset) => {
                const selected = avatarId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAvatarId(preset.id);
                      setShowCustomUrl(false);
                    }}
                    className={`group relative rounded-2xl p-1.5 text-left transition-all cursor-pointer border ${
                      selected
                        ? 'ring-2 ring-sky-400 bg-sky-500/15 border-sky-400/70'
                        : 'bg-black/30 hover:bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900">
                      <img
                        src={preset.imageUrl}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-white truncate mt-1.5 px-0.5">
                      {preset.label}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate px-0.5">
                      {preset.categoryLabel}
                    </p>
                  </button>
                );
              })}
            </div>

            {showCustomUrl && (
              <div>
                <label htmlFor="prof-custom-url" className="block text-xs text-slate-300 mb-1">
                  URL da foto personalizada (ou imagem enviada)
                </label>
                <input
                  id="prof-custom-url"
                  type="text"
                  value={customAvatarUrl}
                  onChange={(e) => {
                    setAvatarId('custom');
                    setCustomAvatarUrl(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full h-10 px-3.5 rounded-xl bg-black/45 border text-xs text-white placeholder:text-slate-500"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            )}
          </section>

          {/* Name & Password */}
          <section className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--ms-border)' }}>
            <div>
              <label htmlFor="prof-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome do perfil
              </label>
              <input
                id="prof-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria, João, Kids, Cinema..."
                maxLength={40}
                required
                className="w-full h-11 px-4 rounded-xl bg-black/45 border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                style={{ borderColor: 'var(--ms-border)' }}
              />
            </div>

            <div className="rounded-2xl bg-black/30 p-4 space-y-3 border" style={{ borderColor: 'var(--ms-border)' }}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Proteger perfil com senha
                    </span>
                    <span className="block text-xs text-slate-400">
                      Exige senha ou PIN (4 a 12 caracteres) ao entrar neste perfil
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={pinEnabled}
                  onChange={(e) => setPinEnabled(e.target.checked)}
                  className="w-5 h-5 accent-sky-500 cursor-pointer"
                />
              </label>

              {editingProfile?.hasPin && !verifiedCurrentPin && (
                <div>
                  <label htmlFor="prof-current-pin" className="block text-xs text-slate-300 mb-1">
                    Senha atual (necessária para alterar ou remover a proteção)
                  </label>
                  <input
                    id="prof-current-pin"
                    type={showPin ? 'text' : 'password'}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="Digite a senha atual"
                    maxLength={12}
                    className="w-full h-10 px-3.5 rounded-xl bg-black/45 border text-sm text-white"
                    style={{ borderColor: 'var(--ms-border)' }}
                  />
                </div>
              )}

              {pinEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor="prof-pin-input" className="block text-xs text-slate-300 mb-1">
                      {editingProfile?.hasPin ? 'Nova senha (opcional para manter)' : 'Senha / PIN'}
                    </label>
                    <div className="relative">
                      <input
                        id="prof-pin-input"
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="4 a 12 caracteres"
                        maxLength={12}
                        className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-black/45 border text-sm text-white"
                        style={{ borderColor: 'var(--ms-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        aria-label={showPin ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="prof-pin-confirm" className="block text-xs text-slate-300 mb-1">
                      Confirmar senha
                    </label>
                    <input
                      id="prof-pin-confirm"
                      type={showPin ? 'text' : 'password'}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Repita a senha"
                      maxLength={12}
                      className="w-full h-10 px-3.5 rounded-xl bg-black/45 border text-sm text-white"
                      style={{ borderColor: 'var(--ms-border)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Preferences: Kids, Theme, Language, Quality, Autoplay */}
          <section className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--ms-border)' }}>
            <h3 className="text-sm font-semibold text-white">Preferências do Perfil</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="prof-theme" className="block text-xs text-slate-300 mb-1">
                  Tema Visual
                </label>
                <select
                  id="prof-theme"
                  value={preferredTheme}
                  onChange={(e) => setPreferredTheme(e.target.value as ThemeId)}
                  className="w-full h-10 px-3 rounded-xl bg-black/45 border text-xs sm:text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                >
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prof-lang" className="block text-xs text-slate-300 mb-1">
                  Idioma
                </label>
                <select
                  id="prof-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-black/45 border text-xs sm:text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>

              <div>
                <label htmlFor="prof-quality" className="block text-xs text-slate-300 mb-1">
                  Qualidade Padrão
                </label>
                <select
                  id="prof-quality"
                  value={preferredQuality}
                  onChange={(e) => setPreferredQuality(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-black/45 border text-xs sm:text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                >
                  <option value="auto">Automática</option>
                  <option value="1080p">Full HD (1080p)</option>
                  <option value="720p">HD (720p)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/30 border cursor-pointer" style={{ borderColor: 'var(--ms-border)' }}>
                <span className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-semibold text-white">Perfil Infantil (Kids)</span>
                    <span className="block text-[11px] text-slate-400">Oculta conteúdo adulto</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={isKids}
                  onChange={(e) => setIsKids(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/30 border cursor-pointer" style={{ borderColor: 'var(--ms-border)' }}>
                <span>
                  <span className="block text-xs font-semibold text-white">Próximo Episódio Automático</span>
                  <span className="block text-[11px] text-slate-400">Avança séries automaticamente</span>
                </span>
                <input
                  type="checkbox"
                  checked={autoplayNext}
                  onChange={(e) => setAutoplayNext(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </label>
            </div>
          </section>

          {error && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Footer Actions */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t"
            style={{ borderColor: 'var(--ms-border)' }}
          >
            <div>
              {editingProfile && canDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-300 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Excluir Perfil
                </button>
              )}
              {editingProfile && canDelete && confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-300 font-medium">Confirmar exclusão?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white cursor-pointer"
                  >
                    Sim, excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white ms-glow cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                {saving ? 'Salvando...' : editingProfile ? 'Salvar Alterações' : 'Criar Perfil'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProfileSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileSelectorModal({ open, onClose }: ProfileSelectorModalProps) {
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

  if (!open) return null;

  const handleCardClick = async (prof: StreamProfile) => {
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
      return;
    }
    if (res.ok) {
      onClose();
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quem está assistindo?"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto"
      >
        <div
          className="w-full max-w-3xl ms-glass rounded-3xl p-6 sm:p-8 space-y-6 border shadow-2xl"
          style={{ borderColor: 'var(--ms-border)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {manageMode ? 'Gerenciar Perfis' : 'Quem está assistindo?'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {manageMode
                  ? 'Clique em um perfil para alterar nome, foto, senha e preferências'
                  : 'Escolha um perfil ou crie um novo para personalizar sua experiência'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar seletor de perfis"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {profiles.map((prof) => {
              const isActive = prof.id === activeProfile?.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => void handleCardClick(prof)}
                  className={`group rounded-2xl p-3 flex flex-col items-center gap-2.5 text-center transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-sky-500/15 border-sky-400/70 ring-2 ring-sky-400/50'
                      : 'bg-black/35 border-white/10 hover:bg-white/10 hover:border-sky-400/40'
                  }`}
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/15">
                    <img
                      src={resolveProfileAvatarUrl(prof.avatarId, prof.avatarUrl)}
                      alt={prof.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {manageMode && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <Pencil className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {prof.hasPin && !manageMode && (
                      <span
                        title="Protegido por senha"
                        className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/80 border border-white/20 flex items-center justify-center text-sky-300"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="w-full min-w-0">
                    <p className="text-sm font-bold text-white truncate">{prof.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {prof.isKids ? 'Infantil' : isActive ? 'Perfil ativo' : 'Selecionar'}
                    </p>
                  </div>
                </button>
              );
            })}

            {profiles.length < MAX_PROFILES_PER_ACCOUNT && (
              <button
                type="button"
                onClick={() => setEditorState({ open: true, editing: null })}
                className="rounded-2xl p-3 flex flex-col items-center justify-center gap-2.5 text-center bg-white/5 hover:bg-white/10 border border-dashed border-sky-400/40 cursor-pointer min-h-[146px]"
              >
                <div className="w-16 h-16 rounded-2xl bg-sky-500/15 flex items-center justify-center text-sky-300">
                  <UserPlus className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Novo Perfil</p>
                  <p className="text-[11px] text-slate-400">Adicionar</p>
                </div>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--ms-border)' }}>
            <button
              type="button"
              onClick={() => setManageMode((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-xs sm:text-sm font-semibold text-white cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-sky-400" aria-hidden="true" />
              {manageMode ? 'Concluir Edição' : 'Gerenciar Perfis'}
            </button>

            {profiles.length < MAX_PROFILES_PER_ACCOUNT && (
              <button
                type="button"
                onClick={() => setEditorState({ open: true, editing: null })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Criar Perfil
              </button>
            )}
          </div>
        </div>
      </div>

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
              onClose();
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
