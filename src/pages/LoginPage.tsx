import React, { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { signInWithGoogle, signInWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e senha para entrar.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      if (rememberMe) {
        localStorage.setItem('megastream_last_email', email.trim());
      }
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Login por e-mail/senha ainda não está habilitado no Firebase Console deste projeto. Use "Entrar com Google" ou habilite o provedor E-mail/Senha em Authentication > Sign-in method.'
        );
      } else {
        setError('Não foi possível entrar. Verifique e-mail e senha ou entre com Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao autenticar com o Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de recuperação de senha.');
      return;
    }
    try {
      await resetPassword(email.trim());
      setInfo('E-mail de redefinição de senha enviado. Verifique sua caixa de entrada.');
    } catch {
      setError('Não foi possível enviar o e-mail de recuperação neste momento.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="ms-glass rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2 items-stretch shadow-2xl">
        <div className="hidden md:block relative min-h-[480px]">
          <img
            src="/src/assets/images/poster_cyber_noir_batman_1794602723138.jpg"
            alt="MegaStream Cinema"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/40 to-transparent" />
          <div className="relative z-10 p-8 h-full flex flex-col justify-end">
            <p className="font-display text-2xl font-bold text-white">
              Entretenimento sem limites
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Acesse sua lista, continue de onde parou e receba recomendações inteligentes.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <Logo />
            <h1 className="font-display text-2xl font-extrabold text-white pt-2">
              Bem-vindo de volta!
            </h1>
            <p className="text-sm text-slate-400">Entre na sua conta para continuar</p>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs sm:text-sm text-red-200">
              {error}
            </div>
          )}

          {info && (
            <div role="status" className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200">
              {info}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-500"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-500"
                  style={{ borderColor: 'var(--ms-border)' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Lembrar-me
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white ms-glow transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="relative flex items-center justify-center text-xs text-slate-500">
            <span className="px-3 bg-[#0a1228]">ou entre com</span>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full h-11 rounded-xl bg-white text-slate-900 text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
            </svg>
            Entrar com Google
          </button>

          <p className="text-center text-xs text-slate-400">
            Ainda não tem conta?{' '}
            <Link to="/register" className="text-sky-400 font-semibold hover:underline">
              Cadastre-se gratuitamente
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
