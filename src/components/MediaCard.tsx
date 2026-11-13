import React, { useState } from 'react';
import { Bookmark, Check, Film, Play, Star, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MediaItem } from '../../shared/types';
import { useAuth } from '../contexts/AuthContext';

interface MediaCardProps {
  item: MediaItem;
  compact?: boolean;
}

export function MediaCard({ item, compact = false }: MediaCardProps) {
  const { isFavorite, toggleFavorite } = useAuth();
  const [imgError, setImgError] = useState(false);
  const favorited = isFavorite(item.tmdbId, item.mediaType);

  const detailUrl = item.mediaType === 'tv' ? `/series/${item.tmdbId}` : `/movie/${item.tmdbId}`;
  const playUrl = `/watch/${item.mediaType}/${item.tmdbId}`;

  const handleFavClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavorite({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      voteAverage: item.voteAverage,
      releaseYear: item.releaseYear,
    });
  };

  return (
    <article
      className={`group relative flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 ${
        compact ? 'w-[156px] sm:w-[184px] shrink-0' : 'w-full'
      }`}
      style={{
        backgroundColor: 'var(--ms-surface-solid)',
        border: '1px solid var(--ms-border)',
      }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        <Link
          to={detailUrl}
          className="block h-full w-full focus-visible:outline-2 focus-visible:outline-blue-400"
          aria-label={`Ver detalhes de ${item.title}`}
        >
          {item.posterPath && !imgError ? (
            <img
              src={item.posterPath}
              alt={item.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#0c1a3a] via-[#070f24] to-[#030612]">
              {item.mediaType === 'tv' ? (
                <Tv className="w-8 h-8 text-sky-400/70 mb-2" aria-hidden="true" />
              ) : (
                <Film className="w-8 h-8 text-sky-400/70 mb-2" aria-hidden="true" />
              )}
              <span className="text-xs font-semibold text-slate-200 line-clamp-3">
                {item.title}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
        </Link>

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Link
            to={playUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg whitespace-nowrap"
            style={{ backgroundColor: 'var(--ms-accent)' }}
            aria-label={`Assistir ${item.title}`}
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            Assistir
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={handleFavClick}
        aria-label={
          favorited ? `Remover ${item.title} da Minha Lista` : `Adicionar ${item.title} à Minha Lista`
        }
        className="absolute top-2.5 right-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-white hover:bg-blue-600/80 transition-colors cursor-pointer"
      >
        {favorited ? (
          <Check className="w-4 h-4 text-sky-300" aria-hidden="true" />
        ) : (
          <Bookmark className="w-4 h-4" aria-hidden="true" />
        )}
      </button>

      <div className="p-3 flex flex-col gap-1">
        <Link
          to={detailUrl}
          className="font-display text-sm font-semibold text-white truncate hover:text-sky-300 transition-colors"
        >
          {item.title}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono-tabular">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star className="w-3 h-3 fill-amber-400" aria-hidden="true" />
            {item.voteAverage > 0 ? item.voteAverage.toFixed(1) : 'N/D'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{item.releaseYear || '—'}</span>
          <span aria-hidden="true">·</span>
          <span>{item.mediaType === 'tv' ? 'Série' : 'Filme'}</span>
        </div>
      </div>
    </article>
  );
}
