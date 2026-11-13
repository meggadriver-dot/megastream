import React, { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import type { AIRecommendationResponse } from '../../shared/types';
import { MediaCard } from '../components/MediaCard';
import { apiRequest } from '../services/apiClient';

const SAMPLE_PROMPTS = [
  'Quero um filme de ação com muita adrenalina e uma história surpreendente.',
  'Séries de ficção científica envolventes para maratonar no fim de semana.',
  'Sugira títulos baseados nos meus favoritos e no meu histórico recente.',
  'Filmes com fotografia épica e nota acima de 8.0 no TMDB.',
];

export function AISmartPage() {
  const [prompt, setPrompt] = useState('');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRecommendation = async (customPrompt?: string) => {
    const query = (customPrompt ?? prompt).trim();
    if (customPrompt) setPrompt(customPrompt);
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AIRecommendationResponse>('/api/ai/recommend', {
        method: 'POST',
        body: JSON.stringify({ prompt: query, mediaType }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar IA Inteligente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runRecommendation();
  };

  return (
    <div className="space-y-6">
      <section className="ms-glass rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 ms-glow"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              IA Inteligente MegaStream
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Pesquise em linguagem natural, analise seu histórico e favoritos e receba listas personalizadas com títulos reais do TMDB.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='Ex: "Quero um filme de ação com muita adrenalina e história surpreendente"'
              aria-label="Descreva o que deseja assistir"
              className="flex-1 h-12 px-4 rounded-xl bg-black/40 border text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              style={{ borderColor: 'var(--ms-border)' }}
            />
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as 'all' | 'movie' | 'tv')}
              aria-label="Filtrar tipo de conteúdo na IA"
              className="h-12 px-4 rounded-xl bg-black/40 border text-sm text-white"
              style={{ borderColor: 'var(--ms-border)' }}
            >
              <option value="all">Filmes e Séries</option>
              <option value="movie">Apenas Filmes</option>
              <option value="tv">Apenas Séries</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="h-12 px-6 rounded-xl text-sm font-semibold text-white ms-glow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--ms-accent)' }}
            >
              <Send className="w-4 h-4" />
              {loading ? 'Analisando...' : 'Recomendar'}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Sugestões rápidas:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void runRecommendation(sample)}
                className="text-left px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border text-xs text-slate-200 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--ms-border)' }}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-5">
          <div className="ms-glass rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300">
                <Sparkles className="w-4 h-4" />
                Curadoria Inteligente
              </span>
              <span className="text-xs text-slate-400 font-mono-tabular">
                Fonte: {result.source}
              </span>
            </div>
            <p className="text-base font-medium text-white">{result.summary}</p>
            <p className="text-xs text-slate-400">{result.strategyNote}</p>

            {result.suggestedQueries.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {result.suggestedQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void runRecommendation(q)}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-sky-300 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {result.items.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
