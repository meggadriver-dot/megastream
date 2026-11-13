import { GoogleGenAI, Type } from '@google/genai';
import { deduplicateMediaByTmdbId } from '../../shared/catalogUtils';
import type {
  AIRecommendationResponse,
  FavoriteItem,
  HistoryItem,
  MediaItem,
} from '../../shared/types';
import { repositoryStore } from '../repositories/interfaces';
import { CatalogService } from './CatalogService';
import { TMDBService } from './TMDBService';

class RecommendationServiceImpl {
  isGeminiConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY?.trim();
    return Boolean(key && key !== 'MY_GEMINI_API_KEY');
  }

  private createClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key || key === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async recommend(params: {
    prompt: string;
    favorites: FavoriteItem[];
    history: HistoryItem[];
    preferredMediaType?: 'all' | 'movie' | 'tv';
  }): Promise<AIRecommendationResponse> {
    const syncedCatalog = await CatalogService.getSyncedCatalog();
    const userPrompt = params.prompt.trim();
    const favTitles = params.favorites.slice(0, 8).map((f) => `${f.title} (${f.mediaType})`);
    const historyTitles = params.history.slice(0, 8).map((h) => `${h.title} (${h.mediaType})`);

    const ai = this.createClient();
    if (!ai) {
      return this.buildDeterministicFallback(userPrompt, syncedCatalog, favTitles, historyTitles);
    }

    try {
      const catalogContext = syncedCatalog.slice(0, 28).map((m) => ({
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        title: m.title,
        year: m.releaseYear,
        rating: m.voteAverage,
        genres: m.genreIds,
        overview: m.overview.slice(0, 140),
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify({
          pedidoUsuario: userPrompt || 'Recomende os melhores títulos com base no meu perfil.',
          tipoPreferido: params.preferredMediaType ?? 'all',
          favoritosUsuario: favTitles,
          historicoRecente: historyTitles,
          catalogoDisponivel: catalogContext,
        }),
        config: {
          systemInstruction:
            'Você é a IA Inteligente do MegaStream. Sua função é analisar o pedido do usuário, favoritos e histórico, e selecionar SOMENTE títulos reais presentes no catálogo TMDB disponível ou sugerir termos reais de busca TMDB (em português ou inglês) para consultar o TMDB. NUNCA invente filmes, séries, notas ou sinopses. Responda em Português do Brasil de forma objetiva e envolvente.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Resumo curatorial em português explicando as recomendações.',
              },
              strategyNote: {
                type: Type.STRING,
                description: 'Critérios usados (gênero, ritmo, histórico ou favoritos).',
              },
              matchedTmdbIds: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Lista de tmdbId selecionados diretamente do catalogoDisponivel.',
              },
              searchQueries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Até 3 termos reais de busca para consultar o TMDB quando necessário.',
              },
              genreKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Sugestões de listas personalizadas ou gêneros compatíveis.',
              },
            },
            required: ['summary', 'strategyNote', 'matchedTmdbIds', 'searchQueries'],
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        summary?: string;
        strategyNote?: string;
        matchedTmdbIds?: number[];
        searchQueries?: string[];
        genreKeywords?: string[];
      };

      const matchedItems: MediaItem[] = [];
      for (const id of parsed.matchedTmdbIds ?? []) {
        const found = syncedCatalog.find((m) => m.tmdbId === id);
        if (found) matchedItems.push(found);
      }

      // If TMDB is live, enrich with real TMDB search queries proposed by Gemini
      if (TMDBService.isConfigured() && (parsed.searchQueries?.length ?? 0) > 0) {
        const searches = await Promise.all(
          (parsed.searchQueries ?? []).slice(0, 3).map((q) =>
            TMDBService.search(q, params.preferredMediaType ?? 'all', 1).catch(() => null)
          )
        );
        for (const res of searches) {
          if (res?.items?.length) {
            matchedItems.push(...res.items.slice(0, 4));
          }
        }
      }

      const finalItems = deduplicateMediaByTmdbId(
        matchedItems.length > 0 ? matchedItems : syncedCatalog.slice(0, 6)
      ).slice(0, 12);

      return {
        summary:
          parsed.summary ||
          'Selecionamos títulos reais do catálogo TMDB alinhados ao seu perfil e solicitação.',
        strategyNote:
          parsed.strategyNote ||
          'Curadoria combinando análise semântica Gemini e dados oficiais do TMDB.',
        suggestedQueries: parsed.genreKeywords ?? parsed.searchQueries ?? [],
        items: finalItems,
        source: TMDBService.isConfigured() ? 'gemini+tmdb' : 'gemini+demo',
      };
    } catch (err) {
      repositoryStore.addLog({
        level: 'warn',
        service: 'RecommendationService',
        message: `Fallback de recomendação acionado: ${err instanceof Error ? err.message : String(err)}`,
      });
      return this.buildDeterministicFallback(userPrompt, syncedCatalog, favTitles, historyTitles);
    }
  }

  private buildDeterministicFallback(
    prompt: string,
    catalog: MediaItem[],
    favTitles: string[],
    historyTitles: string[]
  ): AIRecommendationResponse {
    const q = prompt.toLowerCase();
    const keywordMatches = catalog.filter((item) => {
      if (!q) return true;
      const hay = `${item.title} ${item.originalTitle} ${item.overview}`.toLowerCase();
      return q.split(/\s+/).some((word) => word.length > 3 && hay.includes(word));
    });

    const selected = (keywordMatches.length > 0 ? keywordMatches : catalog)
      .slice()
      .sort((a, b) => b.voteAverage - a.voteAverage)
      .slice(0, 8);

    const contextPieces = [];
    if (favTitles.length > 0) contextPieces.push(`${favTitles.length} favorito(s)`);
    if (historyTitles.length > 0) contextPieces.push(`${historyTitles.length} item(ns) no histórico`);

    return {
      summary:
        q.length > 0
          ? `Resultados do catálogo para "${prompt}" ordenados por relevância e avaliação TMDB.`
          : 'Recomendações curadas com base nos títulos mais bem avaliados do catálogo disponível.',
      strategyNote:
        contextPieces.length > 0
          ? `Baseado no seu perfil (${contextPieces.join(' e ')}) e títulos reais do catálogo.`
          : 'Ordenação por avaliação TMDB e correspondência temática no catálogo carregado.',
      suggestedQueries: ['Ação e Suspense', 'Ficção Científica Épica', 'Séries Aclamadas'],
      items: selected,
      source: 'fallback',
    };
  }
}

export const RecommendationService = new RecommendationServiceImpl();
