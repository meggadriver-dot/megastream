import React, { useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MediaItem } from '../../shared/types';
import { MediaCard } from '../components/MediaCard';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';

export function FavoritesPage() {
  const { favorites, toggleFavorite, firebaseUser } = useAuth();
  const { runtimeSettings } = useSiteConfig();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  const filtered = favorites.filter((f) => (filter === 'all' ? true : f.mediaType === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Minha Lista
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {firebaseUser
              ? 'Seus filmes e séries salvos e sincronizados com sua conta.'
              : runtimeSettings.allowGuestFavorites
                ? 'Salvos neste navegador. Entre na sua conta para sincronizar na nuvem.'
                : 'O administrador exige login na plataforma para salvar favoritos na Minha Lista.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 ms-glass rounded-xl" role="group" aria-label="Filtrar Minha Lista">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'movie', label: 'Filmes' },
              { id: 'tv', label: 'Séries' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
                filter === tab.id ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
              style={filter === tab.id ? { backgroundColor: 'var(--ms-accent)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="ms-glass rounded-3xl p-10 text-center space-y-4">
          <Bookmark className="w-10 h-10 text-sky-400 mx-auto" />
          <h2 className="font-display text-lg font-bold text-white">
            Sua lista está vazia
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Explore filmes e séries do catálogo TMDB e toque no ícone de marcador para salvar seus favoritos aqui.
          </p>
          <Link
            to="/explore"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--ms-accent)' }}
          >
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((fav) => {
            const mediaItem: MediaItem = {
              id: fav.tmdbId,
              tmdbId: fav.tmdbId,
              mediaType: fav.mediaType,
              title: fav.title,
              originalTitle: fav.title,
              overview: '',
              posterPath: fav.posterPath,
              backdropPath: null,
              releaseDate: '',
              releaseYear: fav.releaseYear,
              voteAverage: fav.voteAverage,
              voteCount: 0,
              popularity: 0,
              genreIds: [],
              originalLanguage: 'pt',
              source: 'tmdb',
            };
            return (
              <div key={fav.id} className="space-y-2">
                <MediaCard item={mediaItem} />
                <button
                  type="button"
                  onClick={() => toggleFavorite(mediaItem)}
                  className="w-full py-2 rounded-xl ms-glass text-xs font-medium text-red-300 hover:bg-red-500/15 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
