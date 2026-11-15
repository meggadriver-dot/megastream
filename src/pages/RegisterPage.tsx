import React, { useState } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';

export function RegisterPage() {
  const { registerWithEmail, signInWithGoogle } = useAuth();
  const { runtimeSettings, siteConfig } = useSiteConfig();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }
    if (!acceptedTerms) {
      setError('Você precisa aceitar os Termos de Uso para criar sua conta.');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email.trim(), password);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Cadastro por e-mail/senha ainda não está habilitado no Firebase Console. Utilize "Cadastrar com Google" ou habilite o provedor E-mail/Senha.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!acceptedTerms) {
      setError('Aceite os Termos de Uso antes de continuar.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  if (!runtimeSettings.allowRegistration) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="ms-glass rounded-3xl p-8 text-center space-y-4">
          <Logo />
          <h1 className="font-display text-2xl font-extrabold text-white pt-2">
            Novos cadastros desabilitados
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            O administrador de {siteConfig.siteName} desativou temporariamente o registro de novas contas. Caso já possua acesso, entre com suas credenciais.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              Ir para Login
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="ms-glass rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2 items-stretch shadow-2xl">
        <div className="hidden md:block relative min-h-[520px]">
          <img
            src="/src/assets/images/poster_ocean_avatar_1794602723299.jpg"
            alt="MegaStream Cadastro"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/40 to-transparent" />
          <div className="relative z-10 p-8 h-full flex flex-col justify-end">
            <p className="font-display text-2xl font-bold text-white">
              Crie sua conta MegaStream
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Sincronize seus favoritos e histórico em qualquer dispositivo.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col justify-center space-y-5">
          <div className="space-y-1.5">
            <Logo />
            <h1 className="font-display text-2xl font-extrabold text-white pt-2">
              Crie sua conta
            </h1>
            <p className="text-sm text-slate-400">É rápido e seguro com Firebase</p>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs sm:text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1">
                Nome completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pass" className="block text-xs font-medium text-slate-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-xs font-medium text-slate-300 mb-1">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>
                Li e aceito os Termos de Uso e a Política de Privacidade do MegaStream.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white ms-glow transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleRegister}
            className="w-full h-11 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cadastrar com Google
          </button>

          <p className="text-center text-xs text-slate-400">
            Já possui conta?{' '}
            <Link to="/login" className="text-sky-400 font-semibold hover:underline">
              Entrar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
