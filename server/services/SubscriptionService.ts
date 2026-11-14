import { getPlanById, SUBSCRIPTION_PLANS } from '../../shared/catalogUtils.ts';
import type { PlanId, SubscriptionPlan, SubscriptionRecord } from '../../shared/types.ts';
import { repositoryStore } from '../repositories/interfaces.ts';

class SubscriptionServiceImpl {
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  getUserSubscription(userId: string): SubscriptionRecord | null {
    return repositoryStore.getSubscription(userId);
  }

  selectPlanPendingGateway(
    userId: string,
    planId: Exclude<PlanId, 'free'>
  ): SubscriptionRecord {
    const plan = getPlanById(planId);
    if (!plan) {
      throw new Error('Plano selecionado inválido.');
    }

    const expiresAt = new Date(
      Date.now() + plan.periodDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const record: SubscriptionRecord = {
      userId,
      planId,
      status: 'pending_gateway',
      amountBrl: plan.priceBrl,
      expiresAt,
      gatewayReady: false,
      gatewayNotice:
        'Estrutura preparada para integração de gateway de pagamento (Stripe / Mercado Pago). Nenhuma cobrança real foi simulada.',
      updatedAt: new Date().toISOString(),
    };

    repositoryStore.upsertSubscription(record);
    repositoryStore.addLog({
      level: 'info',
      service: 'SubscriptionService',
      message: `Solicitação de assinatura registrada (gateway pendente): usuário ${userId}, plano ${plan.name}.`,
    });
    return record;
  }
}

export const SubscriptionService = new SubscriptionServiceImpl();
