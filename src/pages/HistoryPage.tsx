import React from 'react';
import { History, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function HistoryPage() {
  const { history } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          Histórico de Reprodução
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Retome filmes e episódios exatamente de onde você parou.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="ms-glass rounded-3xl p-10 text-center space-y-4">
          <History className="w-10 h-10 text-sky-400 mx-auto" />
          <h2 className="font-display text-lg font-bold text-white">
            Nenhuma reprodução registrada ainda
          </h2>
          <p className="text-sm text-slate-400">
            Ao assistir qualquer filme ou série no MegaStream, seu histórico aparecerá aqui automaticamente.
          </p>
          <Link
            to="/explore"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Descobrir títulos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const watchUrl = `/watch/${item.mediaType}/${item.tmdbId}${
              item.seasonNumber
                ? `?season=${item.seasonNumber}&episode=${item.episodeNumber || 1}`
                : ''
            }`;
            return (
              <article
                key={item.id}
                className="ms-glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {item.posterPath ? (
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-20 rounded-xl object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-14 h-20 rounded-xl bg-slate-900 shrink-0" />
                  )}

                  <div className="min-w-0 space-y-1">
                    <h2 className="font-display text-base font-bold text-white truncate">
                      {item.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                      <span>{item.mediaType === 'tv' ? 'Série' : 'Filme'}</span>
                      <span aria-hidden="true">·</span>
                      <span>TMDB #{item.tmdbId}</span>
                      {item.seasonNumber ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            T{item.seasonNumber} · Ep.{item.episodeNumber || 1}
                          </span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>{new Date(item.watchedAt).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <div className="w-48 max-w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(5, item.progressPercent))}%`,
                          backgroundColor: 'var(--ms-accent-bright)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Link
                  to={watchUrl}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--ms-accent)' }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Retomar ({Math.round(item.progressPercent)}%)
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
