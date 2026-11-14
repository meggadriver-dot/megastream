import type { MediaItem, PlanId, SubscriptionPlan } from './types.ts';

export interface CatalogFilterParams {
  mediaType?: 'all' | 'movie' | 'tv';
  genreId?: number | null;
  year?: number | null;
  minRating?: number | null;
  language?: string | null;
  country?: string | null;
  sortBy?: 'popularity' | 'rating' | 'release_date';
  query?: string;
  page?: number;
  pageSize?: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Mensal',
    subtitle: 'Flexibilidade total para começar',
    priceBrl: 29.9,
    billingLabel: 'R$ 29,90 / mês',
    periodDays: 30,
    benefits: [
      'Acesso completo ao catálogo de filmes e séries',
      'IA Inteligente com recomendações personalizadas',
      'Sincronização de Minha Lista e Histórico na nuvem',
      'Sem fidelidade — cancele quando desejar',
    ],
  },
  {
    id: 'quarterly',
    name: 'Trimestral',
    subtitle: 'Mais popular · Melhor custo-benefício',
    priceBrl: 59.9,
    billingLabel: 'R$ 59,90 / 3 meses',
    periodDays: 90,
    popular: true,
    benefits: [
      'Economize 33% comparado ao plano mensal',
      'Acesso completo em smartphones, tablets e TVs',
      'Listas personalizadas ilimitadas com IA',
      'Prioridade nos novos recursos da plataforma',
    ],
  },
  {
    id: 'annual',
    name: 'Anual',
    subtitle: 'Experiência definitiva o ano inteiro',
    priceBrl: 199.9,
    billingLabel: 'R$ 199,90 / ano',
    periodDays: 365,
    benefits: [
      'Equivalente a mais de 2 meses grátis no ano',
      'Todos os 5 temas exclusivos desbloqueados',
      'Suporte prioritário e canais autorizados ao vivo',
      'Controle parental e múltiplos perfis de acesso',
    ],
  },
];

export function getPlanById(planId: PlanId): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? null;
}

export function sanitizePlainText(value: string, maxLength = 200): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function filterAndSortMedia(
  items: MediaItem[],
  filters: CatalogFilterParams
): { items: MediaItem[]; totalResults: number; totalPages: number; page: number } {
  const query = (filters.query ?? '').trim().toLowerCase();
  const pageSize = Math.max(1, Math.min(40, filters.pageSize ?? 20));
  const requestedPage = Math.max(1, filters.page ?? 1);

  const filtered = items.filter((item) => {
    if (filters.mediaType && filters.mediaType !== 'all' && item.mediaType !== filters.mediaType) {
      return false;
    }
    if (filters.genreId && !item.genreIds.includes(filters.genreId)) {
      return false;
    }
    if (filters.year && Number(item.releaseYear) !== filters.year) {
      return false;
    }
    if (typeof filters.minRating === 'number' && filters.minRating > 0 && item.voteAverage < filters.minRating) {
      return false;
    }
    if (filters.language && filters.language !== 'all' && item.originalLanguage !== filters.language) {
      return false;
    }
    if (
      filters.country &&
      filters.country !== 'all' &&
      !(item.originCountry ?? []).includes(filters.country)
    ) {
      return false;
    }
    if (query) {
      const hay = `${item.title} ${item.originalTitle} ${item.overview}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === 'rating') {
      return b.voteAverage - a.voteAverage;
    }
    if (filters.sortBy === 'release_date') {
      return (b.releaseDate || '').localeCompare(a.releaseDate || '');
    }
    return b.popularity - a.popularity;
  });

  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    totalResults,
    totalPages,
    page,
  };
}

export function deduplicateMediaByTmdbId(items: MediaItem[]): MediaItem[] {
  const seen = new Map<string, MediaItem>();
  for (const item of items) {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

export function formatRuntimeMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return 'Duração N/D';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}min`;
  return `${hrs}h ${mins}min`;
}

export function formatBrlCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
