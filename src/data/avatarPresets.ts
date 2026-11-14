import avatarAnimePilot from '../assets/images/avatar_anime_pilot_1794675752025.jpg';
import avatarCartoonHero from '../assets/images/avatar_cartoon_hero_1794675751477.jpg';
import avatarKidsDino from '../assets/images/avatar_kids_dino_1794675753063.jpg';
import avatarMovieAstronaut from '../assets/images/avatar_movie_astronaut_1794675753848.jpg';
import avatarMovieExplorer from '../assets/images/avatar_movie_explorer_1794675752185.jpg';
import avatarMovieVigilante from '../assets/images/avatar_movie_vigilante_1794675753040.jpg';
import avatarSeriesDetective from '../assets/images/avatar_series_detective_1794675751043.jpg';
import avatarSeriesQueen from '../assets/images/avatar_series_queen_1794675751674.jpg';
import type { AvatarCategory } from '../../shared/types';

export interface ClientAvatarPreset {
  id: string;
  label: string;
  category: Exclude<AvatarCategory, 'todos'>;
  categoryLabel: string;
  imageUrl: string;
}

export const CLIENT_AVATAR_PRESETS: readonly ClientAvatarPreset[] = [
  {
    id: 'avatar_cartoon_hero',
    label: 'Herói Animado',
    category: 'desenhos',
    categoryLabel: 'Desenhos',
    imageUrl: avatarCartoonHero,
  },
  {
    id: 'avatar_anime_pilot',
    label: 'Piloto Cyber',
    category: 'desenhos',
    categoryLabel: 'Desenhos',
    imageUrl: avatarAnimePilot,
  },
  {
    id: 'avatar_kids_dino',
    label: 'Dino Pipoca',
    category: 'infantil',
    categoryLabel: 'Infantil',
    imageUrl: avatarKidsDino,
  },
  {
    id: 'avatar_series_detective',
    label: 'Detetive Noir',
    category: 'series',
    categoryLabel: 'Séries',
    imageUrl: avatarSeriesDetective,
  },
  {
    id: 'avatar_series_queen',
    label: 'Rainha Fantasia',
    category: 'series',
    categoryLabel: 'Séries',
    imageUrl: avatarSeriesQueen,
  },
  {
    id: 'avatar_movie_explorer',
    label: 'Explorador Duna',
    category: 'filmes',
    categoryLabel: 'Filmes',
    imageUrl: avatarMovieExplorer,
  },
  {
    id: 'avatar_movie_vigilante',
    label: 'Vigilante Noturno',
    category: 'filmes',
    categoryLabel: 'Filmes',
    imageUrl: avatarMovieVigilante,
  },
  {
    id: 'avatar_movie_astronaut',
    label: 'Astronauta Neon',
    category: 'filmes',
    categoryLabel: 'Filmes',
    imageUrl: avatarMovieAstronaut,
  },
] as const;

export const AVATAR_CATEGORIES: readonly { id: AvatarCategory; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'desenhos', label: 'Desenhos' },
  { id: 'series', label: 'Séries' },
  { id: 'filmes', label: 'Filmes' },
  { id: 'infantil', label: 'Infantil' },
] as const;

export function resolveProfileAvatarUrl(avatarId?: string | null, avatarUrl?: string | null): string {
  if (avatarId && avatarId !== 'custom') {
    const matched = CLIENT_AVATAR_PRESETS.find((preset) => preset.id === avatarId);
    if (matched) return matched.imageUrl;
  }
  if (avatarUrl && avatarUrl.trim().length > 0) {
    return avatarUrl;
  }
  return avatarMovieAstronaut;
}
