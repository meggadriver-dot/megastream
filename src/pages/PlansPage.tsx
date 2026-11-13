import React, { useEffect, useState } from 'react';
import { Check, Crown, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBrlCurrency } from '../../shared/catalogUtils';
import type { PlanId, SubscriptionPlan, SubscriptionRecord } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiClient';

export function PlansPage() {
  const { firebaseUser } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<PlanId | null>(null);

  useEffect(() => {
    apiRequest<{ items: SubscriptionPlan[] }>('/api/plans')
      .then((res) => setPlans(res.items))
      .catch(() => {});

    if (firebaseUser) {
      apiRequest<{ subscription: SubscriptionRecord | null }>('/api/users/me')
        .then((res) => setSubscription(res.subscription))
        .catch(() => {});
    }
  }, [firebaseUser]);

  const handleSelectPlan = async (planId: Exclude<PlanId, 'free'>) => {
    if (!firebaseUser) {
      setFeedback('Entre na sua conta primeiro para registrar sua intenção de assinatura.');
      return;
    }
    setSubmitting(planId);
    setFeedback(null);
    try {
      const record = await apiRequest<SubscriptionRecord>('/api/subscriptions/select', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      setSubscription(record);
      setFeedback(record.gatewayNotice);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao selecionar plano.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300">
          <Crown className="w-4 h-4" />
          Planos e Assinaturas
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white [text-wrap:balance]">
          Escolha o plano ideal para você
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Controle transparente de assinatura, benefícios, vencimento e integração preparada para gateway de pagamento.
        </p>
      </div>

      {subscription && (
        <div className="ms-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border-sky-400/30">
          <div>
            <p className="text-xs text-slate-400">Status da Assinatura</p>
            <p className="text-sm font-semibold text-white">
              Plano selecionado: <span className="text-sky-300 uppercase">{subscription.planId}</span> ·{' '}
              {subscription.status === 'pending_gateway'
                ? 'Aguardando integração do gateway'
                : subscription.status}
            </p>
          </div>
          {subscription.expiresAt && (
            <p className="text-xs text-slate-300 font-mono-tabular">
              Ciclo previsto até {new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div role="status" className="ms-glass rounded-2xl p-4 flex items-start gap-3 text-sm text-sky-200">
          <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p>{feedback}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`ms-glass rounded-3xl p-6 flex flex-col justify-between space-y-6 ${
              plan.popular ? 'ring-2 ring-sky-400 ms-glow' : ''
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">{plan.name}</h2>
                {plan.popular && (
                  <span className="text-xs font-semibold text-sky-300">Mais Popular</span>
                )}
              </div>
              <p className="text-xs text-slate-400">{plan.subtitle}</p>

              <div className="pt-2">
                <span className="font-display text-3xl font-extrabold text-white font-mono-tabular">
                  {formatBrlCurrency(plan.priceBrl)}
                </span>
                <p className="text-xs text-slate-400 mt-1">{plan.billingLabel}</p>
              </div>

              <ul className="space-y-2.5 pt-2">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {firebaseUser ? (
              <button
                type="button"
                disabled={submitting === plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                {submitting === plan.id ? 'Registrando...' : `Selecionar ${plan.name}`}
              </button>
            ) : (
              <Link
                to="/login"
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center"
                style={{ backgroundColor: 'var(--ms-accent)' }}
              >
                Entrar para Assinar
              </Link>
            )}
          </article>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400">
        Ambiente preparado para checkout real via Stripe ou Mercado Pago. Nenhum pagamento fictício é processado nesta etapa.
      </p>
    </div>
  );
}
